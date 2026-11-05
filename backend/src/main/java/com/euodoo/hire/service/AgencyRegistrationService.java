package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.AgencyDraftRequest;
import com.euodoo.hire.dto.request.AgencyRegistrationRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.model.AgencyDocumentType;
import com.euodoo.hire.model.AgencyRegistrationStatus;
import com.euodoo.hire.model.AgencyType;
import com.euodoo.hire.exception.AgencyExceptions.*;
import com.euodoo.hire.exception.AgencyNotFoundException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.service.AgencyMapper;
import com.euodoo.hire.model.Agency;
import com.euodoo.hire.repository.AgencyRepository;
import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyRegistrationService {

    private final AgencyRepository agencyRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final AgencyDocumentService agencyDocumentService;

    public AgencyResponse registerAgency(AgencyRegistrationRequest request) {
        return registerAgency(request, null, null);
    }

    public AgencyResponse registerAgency(AgencyRegistrationRequest request, MultipartFile incorporationFile, MultipartFile gstFile) {
        String email = request.getOfficialEmail().trim().toLowerCase();
        if (agencyRepository.existsByOfficialEmailIgnoreCase(email) || userRepository.existsByEmail(email)) {
            throw new AgencyAlreadyExistsException("An agency or user account already exists with official email: " + email);
        }

        if (request.getBusinessRegistrationNumber() != null &&
                agencyRepository.existsByBusinessRegistrationNumber(request.getBusinessRegistrationNumber().trim())) {
            throw new AgencyAlreadyExistsException("An agency already exists with business registration number: " + request.getBusinessRegistrationNumber());
        }

        // Create User account with role AGENCY_ADMIN and accountStatus PENDING_APPROVAL
        User user = User.builder()
                .name(request.getAgencyName())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.AGENCY_ADMIN)
                .accountStatus(AccountStatus.PENDING_APPROVAL)
                .build();
        User savedUser = userRepository.save(user);

        String effectiveLinkedin = request.getLinkedin() != null ? request.getLinkedin().trim() :
                (request.getRepresentative() != null ? request.getRepresentative().getLinkedin() : null);

        // Create Agency record
        Agency agency = Agency.builder()
                .agencyName(request.getAgencyName().trim())
                .agencyType(request.getAgencyType() != null ? request.getAgencyType() : AgencyType.RECRUITMENT_AGENCY)
                .otherAgencyType(request.getOtherAgencyType())
                .businessRegistrationNumber(request.getBusinessRegistrationNumber() != null ? request.getBusinessRegistrationNumber().trim() : null)
                .establishmentYear(request.getEstablishmentYear())
                .officeModel(request.getOfficeModel())
                .gstNumber(request.getGstNumber() != null ? request.getGstNumber().trim() : null)
                .panNumber(request.getPanNumber() != null ? request.getPanNumber().trim() : null)
                .officialEmail(email)
                .contactNumber(request.getContactNumber())
                .alternateContactNumber(request.getAlternateContactNumber())
                .website(request.getWebsite())
                .linkedin(effectiveLinkedin)
                .representative(request.getRepresentative())
                .officeAddress(request.getOfficeAddress())
                .registrationDate(Instant.now())
                .registrationStatus(AgencyRegistrationStatus.SUBMITTED)
                .submittedAt(Instant.now())
                .registeredUserId(savedUser.getId())
                .build();

        Agency savedAgency = agencyRepository.save(agency);

        // Update user's agencyId
        savedUser.setAgencyId(savedAgency.getId());
        userRepository.save(savedUser);

        // Upload documents if supplied
        if (incorporationFile != null && !incorporationFile.isEmpty()) {
            agencyDocumentService.uploadDocument(savedAgency.getId(), AgencyDocumentType.COMPANY_REGISTRATION_CERTIFICATE, incorporationFile, savedUser.getId());
        }
        if (gstFile != null && !gstFile.isEmpty()) {
            agencyDocumentService.uploadDocument(savedAgency.getId(), AgencyDocumentType.GST_CERTIFICATE, gstFile, savedUser.getId());
        }

        auditService.log(savedUser.getId(), "AGENCY_ADMIN", "Agency", savedAgency.getId(),
                "AGENCY_REGISTERED", Map.of("email", email, "name", savedAgency.getAgencyName()));

        log.info("New agency registered: id={}, name={}, email={}", savedAgency.getId(), savedAgency.getAgencyName(), email);
        return AgencyMapper.toAgencyResponse(savedAgency);
    }

    public AgencyResponse saveDraft(AgencyDraftRequest request) {
        String email = request.getOfficialEmail().trim().toLowerCase();

        Agency agency;
        if (request.getId() != null && !request.getId().isBlank()) {
            agency = agencyRepository.findById(request.getId())
                    .orElseThrow(() -> new AgencyNotFoundException(request.getId()));
            if (agency.getOfficialEmail() != null && !agency.getOfficialEmail().equalsIgnoreCase(email)) {
                log.warn("Security alert: Attempted draft modification for agency [{}] with mismatched email [{}] (actual: [{}])",
                        request.getId(), email, agency.getOfficialEmail());
                throw new BusinessException("DRAFT_EMAIL_MISMATCH", "Draft ID does not match the provided official email.");
            }
        } else {
            agency = agencyRepository.findByOfficialEmailIgnoreCase(email).orElse(null);
        }

        if (agency == null) {
            agency = Agency.builder()
                    .officialEmail(email)
                    .registrationStatus(AgencyRegistrationStatus.DRAFT)
                    .build();
        }

        if (agency.getRegistrationStatus() != AgencyRegistrationStatus.DRAFT
                && agency.getRegistrationStatus() != AgencyRegistrationStatus.RESUBMISSION_REQUIRED) {
            throw new InvalidStatusTransitionException("Cannot update agency as draft when status is " + agency.getRegistrationStatus());
        }

        if (request.getAgencyName() != null) agency.setAgencyName(request.getAgencyName().trim());
        if (request.getAgencyType() != null) agency.setAgencyType(request.getAgencyType());
        if (request.getOtherAgencyType() != null) agency.setOtherAgencyType(request.getOtherAgencyType());
        if (request.getBusinessRegistrationNumber() != null) agency.setBusinessRegistrationNumber(request.getBusinessRegistrationNumber().trim());
        if (request.getEstablishmentYear() != null) agency.setEstablishmentYear(request.getEstablishmentYear());
        if (request.getOfficeModel() != null) agency.setOfficeModel(request.getOfficeModel());
        if (request.getGstNumber() != null) agency.setGstNumber(request.getGstNumber().trim());
        if (request.getPanNumber() != null) agency.setPanNumber(request.getPanNumber().trim());
        if (request.getContactNumber() != null) agency.setContactNumber(request.getContactNumber());
        if (request.getAlternateContactNumber() != null) agency.setAlternateContactNumber(request.getAlternateContactNumber());
        if (request.getWebsite() != null) agency.setWebsite(request.getWebsite());
        if (request.getLinkedin() != null) agency.setLinkedin(request.getLinkedin());
        if (request.getRepresentative() != null) agency.setRepresentative(request.getRepresentative());
        if (request.getOfficeAddress() != null) agency.setOfficeAddress(request.getOfficeAddress());

        // Create or update Draft user account if password given and user does not exist
        if (agency.getRegisteredUserId() == null && request.getPassword() != null && !request.getPassword().isBlank()) {
            if (!userRepository.existsByEmail(email)) {
                User user = User.builder()
                        .name(agency.getAgencyName() != null ? agency.getAgencyName() : "Draft Agency")
                        .email(email)
                        .passwordHash(passwordEncoder.encode(request.getPassword()))
                        .role(Role.AGENCY_ADMIN)
                        .accountStatus(AccountStatus.PENDING_APPROVAL)
                        .build();
                User savedUser = userRepository.save(user);
                agency.setRegisteredUserId(savedUser.getId());
            }
        }

        Agency saved = agencyRepository.save(agency);
        if (agency.getRegisteredUserId() != null) {
            userRepository.findById(agency.getRegisteredUserId()).ifPresent(u -> {
                if (u.getAgencyId() == null) {
                    u.setAgencyId(saved.getId());
                    userRepository.save(u);
                }
            });
        }

        return AgencyMapper.toAgencyResponse(saved);
    }

    public AgencyResponse submitRegistration(String agencyId) {
        Agency agency = agencyRepository.findById(agencyId)
                .orElseThrow(() -> new AgencyNotFoundException(agencyId));

        if (agency.getAgencyName() == null || agency.getBusinessRegistrationNumber() == null ||
                agency.getOfficialEmail() == null || agency.getContactNumber() == null) {
            throw new InvalidStatusTransitionException("Required fields must be completed before submitting registration");
        }

        agency.setRegistrationStatus(AgencyRegistrationStatus.SUBMITTED);
        agency.setSubmittedAt(Instant.now());
        if (agency.getRegistrationDate() == null) {
            agency.setRegistrationDate(Instant.now());
        }

        Agency saved = agencyRepository.save(agency);
        auditService.log(agency.getRegisteredUserId(), "AGENCY_ADMIN", "Agency", saved.getId(),
                "AGENCY_SUBMITTED_FOR_VERIFICATION", Map.of("email", saved.getOfficialEmail()));

        return AgencyMapper.toAgencyResponse(saved);
    }

    public AgencyResponse getRegistrationStatus(String officialEmailOrId) {
        Agency agency = agencyRepository.findById(officialEmailOrId)
                .or(() -> agencyRepository.findByOfficialEmailIgnoreCase(officialEmailOrId))
                .orElseThrow(() -> new AgencyNotFoundException(officialEmailOrId));

        return AgencyMapper.toAgencyResponse(agency);
    }

    /** Safe status lookup for unauthenticated public requests without exposing PII/PAN/GST. */
    public AgencyResponse getPublicRegistrationStatus(String officialEmailOrId) {
        Agency agency = agencyRepository.findById(officialEmailOrId)
                .or(() -> agencyRepository.findByOfficialEmailIgnoreCase(officialEmailOrId))
                .orElseThrow(() -> new AgencyNotFoundException(officialEmailOrId));

        return AgencyMapper.toSafePublicRegistrationStatusResponse(agency);
    }
}
