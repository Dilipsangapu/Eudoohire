package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.AgencyUpdateRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.exception.AgencyNotFoundException;
import com.euodoo.hire.service.AgencyMapper;
import com.euodoo.hire.model.Agency;
import com.euodoo.hire.repository.AgencyRepository;
import com.euodoo.hire.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyProfileService {

    private final AgencyRepository agencyRepository;
    private final AuditService auditService;

    public AgencyResponse getProfile(String agencyId) {
        Agency agency = agencyRepository.findById(agencyId)
                .orElseThrow(() -> new AgencyNotFoundException(agencyId));
        return AgencyMapper.toAgencyResponse(agency);
    }

    public AgencyResponse updateProfile(String agencyId, AgencyUpdateRequest request, String userId) {
        Agency agency = agencyRepository.findById(agencyId)
                .orElseThrow(() -> new AgencyNotFoundException(agencyId));

        if (request.getAgencyName() != null && !request.getAgencyName().isBlank()) {
            agency.setAgencyName(request.getAgencyName().trim());
        }
        if (request.getAgencyType() != null) {
            agency.setAgencyType(request.getAgencyType());
        }
        if (request.getOtherAgencyType() != null) {
            agency.setOtherAgencyType(request.getOtherAgencyType());
        }
        if (request.getContactNumber() != null) {
            agency.setContactNumber(request.getContactNumber());
        }
        if (request.getAlternateContactNumber() != null) {
            agency.setAlternateContactNumber(request.getAlternateContactNumber());
        }
        if (request.getWebsite() != null) {
            agency.setWebsite(request.getWebsite());
        }
        if (request.getRepresentative() != null) {
            agency.setRepresentative(request.getRepresentative());
        }
        if (request.getOfficeAddress() != null) {
            agency.setOfficeAddress(request.getOfficeAddress());
        }

        Agency saved = agencyRepository.save(agency);

        auditService.log(userId, "AGENCY_USER", "Agency", saved.getId(),
                "AGENCY_PROFILE_UPDATED", Map.of("name", saved.getAgencyName()));

        return AgencyMapper.toAgencyResponse(saved);
    }
}
