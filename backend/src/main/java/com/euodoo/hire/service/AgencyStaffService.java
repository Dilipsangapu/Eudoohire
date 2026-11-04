package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.AgencyStaffCreateRequest;
import com.euodoo.hire.dto.request.AgencyStaffUpdateRequest;
import com.euodoo.hire.dto.response.AgencyStaffResponse;
import com.euodoo.hire.exception.AgencyExceptions.AgencyAlreadyExistsException;
import com.euodoo.hire.exception.AgencyExceptions.UnauthorizedAgencyAccessException;
import com.euodoo.hire.service.AgencyMapper;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyStaffService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public AgencyStaffResponse addStaff(String agencyId, AgencyStaffCreateRequest request, String creatorUserId) {
        String email = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new AgencyAlreadyExistsException("A user with this email already exists: " + email);
        }

        User staff = User.builder()
                .name(request.getName().trim())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.AGENCY_STAFF)
                .accountStatus(AccountStatus.ACTIVE)
                .agencyId(agencyId)
                .build();

        User saved = userRepository.save(staff);

        auditService.log(creatorUserId, "AGENCY_ADMIN", "User", saved.getId(),
                "AGENCY_STAFF_CREATED", Map.of("email", email, "agencyId", agencyId));

        return AgencyMapper.toStaffResponse(saved);
    }

    public List<AgencyStaffResponse> getStaff(String agencyId) {
        return userRepository.findAll().stream()
                .filter(u -> agencyId.equals(u.getAgencyId()))
                .map(AgencyMapper::toStaffResponse)
                .collect(Collectors.toList());
    }

    public AgencyStaffResponse updateStaff(String agencyId, String staffUserId, AgencyStaffUpdateRequest request, String actorUserId) {
        User staff = userRepository.findById(staffUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", staffUserId));

        if (!agencyId.equals(staff.getAgencyId())) {
            throw new UnauthorizedAgencyAccessException("Staff member does not belong to this agency");
        }

        if (request.getName() != null && !request.getName().isBlank()) {
            staff.setName(request.getName().trim());
        }
        if (request.getStatus() != null) {
            staff.setAccountStatus(request.getStatus());
        }

        User saved = userRepository.save(staff);

        auditService.log(actorUserId, "AGENCY_ADMIN", "User", saved.getId(),
                "AGENCY_STAFF_UPDATED", Map.of("staffEmail", saved.getEmail()));

        return AgencyMapper.toStaffResponse(saved);
    }
}
