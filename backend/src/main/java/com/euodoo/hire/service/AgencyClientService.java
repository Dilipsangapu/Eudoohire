package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.AgencyClientRequest;
import com.euodoo.hire.dto.response.AgencyClientResponse;
import com.euodoo.hire.model.AgencyClientStatus;
import com.euodoo.hire.exception.AgencyExceptions.ClientCompanyNotFoundException;
import com.euodoo.hire.service.AgencyMapper;
import com.euodoo.hire.model.AgencyClient;
import com.euodoo.hire.repository.AgencyClientRepository;
import com.euodoo.hire.repository.CandidateSubmissionRepository;
import com.euodoo.hire.model.ApprovalStatus;
import com.euodoo.hire.model.Company;
import com.euodoo.hire.repository.CompanyRepository;
import com.euodoo.hire.repository.JobRepository;
import com.euodoo.hire.service.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgencyClientService {

    private final AgencyClientRepository agencyClientRepository;
    private final CompanyRepository companyRepository;
    private final JobRepository jobRepository;
    private final CandidateSubmissionRepository submissionRepository;
    private final AuditService auditService;

    public AgencyClientResponse addClient(String agencyId, AgencyClientRequest request, String userId) {
        String companyId = request.getCompanyId();

        // If companyId is not provided, look up or create in platform Company repository to maintain shared company registry
        if (companyId == null || companyId.isBlank()) {
            Company platformCompany = companyRepository.findAll().stream()
                    .filter(c -> c.getName().equalsIgnoreCase(request.getCompanyName().trim()))
                    .findFirst()
                    .orElseGet(() -> {
                        Company newComp = Company.builder()
                                .name(request.getCompanyName().trim())
                                .industry(request.getIndustry())
                                .website(request.getWebsite())
                                .contactEmail(request.getOfficialEmail())
                                .contactPhone(request.getContactNumber())
                                .headquarters(request.getCity() != null ? request.getCity() + ", " + request.getCountry() : request.getCountry())
                                .approvalStatus(ApprovalStatus.APPROVED)
                                .build();
                        return companyRepository.save(newComp);
                    });
            companyId = platformCompany.getId();
        }

        AgencyClient client = AgencyClient.builder()
                .agencyId(agencyId)
                .companyId(companyId)
                .companyName(request.getCompanyName().trim())
                .industry(request.getIndustry())
                .website(request.getWebsite())
                .officialEmail(request.getOfficialEmail())
                .contactPerson(request.getContactPerson())
                .contactNumber(request.getContactNumber())
                .address(request.getAddress())
                .country(request.getCountry())
                .state(request.getState())
                .city(request.getCity())
                .pinCode(request.getPinCode())
                .status(AgencyClientStatus.ACTIVE)
                .build();

        AgencyClient saved = agencyClientRepository.save(client);

        auditService.log(userId, "AGENCY_USER", "AgencyClient", saved.getId(),
                "AGENCY_CLIENT_ADDED", Map.of("companyName", saved.getCompanyName()));

        return AgencyMapper.toClientResponse(saved, 0, 0);
    }

    public Page<AgencyClientResponse> getClients(String agencyId, int page, int size, String search, AgencyClientStatus status) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        List<AgencyClient> all = agencyClientRepository.findByAgencyId(agencyId);

        List<AgencyClient> filtered = all.stream()
                .filter(c -> status == null || c.getStatus() == status)
                .filter(c -> search == null || search.isBlank() ||
                        (c.getCompanyName() != null && c.getCompanyName().toLowerCase().contains(search.toLowerCase())) ||
                        (c.getIndustry() != null && c.getIndustry().toLowerCase().contains(search.toLowerCase())))
                .collect(Collectors.toList());

        int start = Math.min((int) pageRequest.getOffset(), filtered.size());
        int end = Math.min((start + pageRequest.getPageSize()), filtered.size());
        List<AgencyClientResponse> pageContent = filtered.subList(start, end).stream()
                .map(c -> {
                    long jobCount = jobRepository.countByAgencyIdAndStatus(agencyId, null);
                    long submissionCount = submissionRepository.countByAgencyId(agencyId);
                    return AgencyMapper.toClientResponse(c, jobCount, submissionCount);
                })
                .collect(Collectors.toList());

        return new PageImpl<>(pageContent, pageRequest, filtered.size());
    }

    public AgencyClientResponse getClient(String agencyId, String clientId) {
        AgencyClient client = agencyClientRepository.findByIdAndAgencyId(clientId, agencyId)
                .orElseThrow(() -> new ClientCompanyNotFoundException(clientId));

        long jobCount = jobRepository.findByAgencyIdAndClientCompanyId(agencyId, client.getId(), PageRequest.of(0, 1)).getTotalElements();
        long submissionCount = submissionRepository.findByAgencyId(agencyId).stream()
                .filter(s -> clientId.equals(s.getClientCompanyId()))
                .count();

        return AgencyMapper.toClientResponse(client, jobCount, submissionCount);
    }

    public AgencyClientResponse updateClient(String agencyId, String clientId, AgencyClientRequest request, String userId) {
        AgencyClient client = agencyClientRepository.findByIdAndAgencyId(clientId, agencyId)
                .orElseThrow(() -> new ClientCompanyNotFoundException(clientId));

        if (request.getCompanyName() != null && !request.getCompanyName().isBlank()) {
            client.setCompanyName(request.getCompanyName().trim());
        }
        if (request.getIndustry() != null) client.setIndustry(request.getIndustry());
        if (request.getWebsite() != null) client.setWebsite(request.getWebsite());
        if (request.getOfficialEmail() != null) client.setOfficialEmail(request.getOfficialEmail());
        if (request.getContactPerson() != null) client.setContactPerson(request.getContactPerson());
        if (request.getContactNumber() != null) client.setContactNumber(request.getContactNumber());
        if (request.getAddress() != null) client.setAddress(request.getAddress());
        if (request.getCountry() != null) client.setCountry(request.getCountry());
        if (request.getState() != null) client.setState(request.getState());
        if (request.getCity() != null) client.setCity(request.getCity());
        if (request.getPinCode() != null) client.setPinCode(request.getPinCode());

        AgencyClient saved = agencyClientRepository.save(client);

        auditService.log(userId, "AGENCY_USER", "AgencyClient", saved.getId(),
                "AGENCY_CLIENT_UPDATED", Map.of("companyName", saved.getCompanyName()));

        return AgencyMapper.toClientResponse(saved, 0, 0);
    }

    public AgencyClientResponse updateStatus(String agencyId, String clientId, AgencyClientStatus status, String userId) {
        AgencyClient client = agencyClientRepository.findByIdAndAgencyId(clientId, agencyId)
                .orElseThrow(() -> new ClientCompanyNotFoundException(clientId));

        client.setStatus(status);
        AgencyClient saved = agencyClientRepository.save(client);

        auditService.log(userId, "AGENCY_USER", "AgencyClient", saved.getId(),
                "AGENCY_CLIENT_STATUS_CHANGED", Map.of("status", status.name()));

        return AgencyMapper.toClientResponse(saved, 0, 0);
    }
}
