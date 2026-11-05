package com.euodoo.hire.service;

import com.euodoo.hire.dto.response.*;
import com.euodoo.hire.model.*;
import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.User;

public final class AgencyMapper {

    private AgencyMapper() {}

    public static AgencyResponse toAgencyResponse(Agency agency) {
        if (agency == null) return null;
        return AgencyResponse.builder()
                .id(agency.getId())
                .agencyName(agency.getAgencyName())
                .agencyType(agency.getAgencyType())
                .otherAgencyType(agency.getOtherAgencyType())
                .businessRegistrationNumber(agency.getBusinessRegistrationNumber())
                .establishmentYear(agency.getEstablishmentYear())
                .officeModel(agency.getOfficeModel())
                .gstNumber(agency.getGstNumber())
                .panNumber(agency.getPanNumber())
                .officialEmail(agency.getOfficialEmail())
                .contactNumber(agency.getContactNumber())
                .alternateContactNumber(agency.getAlternateContactNumber())
                .website(agency.getWebsite())
                .linkedin(agency.getLinkedin())
                .representative(agency.getRepresentative())
                .officeAddress(agency.getOfficeAddress())
                .registrationDate(agency.getRegistrationDate())
                .registrationStatus(agency.getRegistrationStatus())
                .registeredUserId(agency.getRegisteredUserId())
                .reviewedByAdminId(agency.getReviewedByAdminId())
                .rejectionReason(agency.getRejectionReason())
                .verificationRemarks(agency.getVerificationRemarks())
                .submittedAt(agency.getSubmittedAt())
                .reviewedAt(agency.getReviewedAt())
                .createdAt(agency.getCreatedAt())
                .updatedAt(agency.getUpdatedAt())
                .build();
    }

    /**
     * Sanitized response for public/unauthenticated status inquiries.
     * Prevents leakage of sensitive business data (PAN, GST, direct contact numbers, address, representative info).
     */
    public static AgencyResponse toSafePublicRegistrationStatusResponse(Agency agency) {
        if (agency == null) return null;
        return AgencyResponse.builder()
                .id(agency.getId())
                .agencyName(agency.getAgencyName())
                .agencyType(agency.getAgencyType())
                .registrationStatus(agency.getRegistrationStatus())
                .submittedAt(agency.getSubmittedAt())
                .registrationDate(agency.getRegistrationDate())
                .rejectionReason(agency.getRejectionReason())
                .verificationRemarks(agency.getVerificationRemarks())
                .createdAt(agency.getCreatedAt())
                .updatedAt(agency.getUpdatedAt())
                .build();
    }

    public static AgencyDocumentResponse toDocumentResponse(AgencyDocument doc) {
        if (doc == null) return null;
        return AgencyDocumentResponse.builder()
                .id(doc.getId())
                .agencyId(doc.getAgencyId())
                .documentType(doc.getDocumentType())
                .secureUrl(doc.getSecureUrl())
                .originalFilename(doc.getOriginalFilename())
                .mimeType(doc.getMimeType())
                .fileSizeBytes(doc.getFileSizeBytes())
                .verificationStatus(doc.getVerificationStatus())
                .verifiedByAdminId(doc.getVerifiedByAdminId())
                .verificationRemarks(doc.getVerificationRemarks())
                .verifiedAt(doc.getVerifiedAt())
                .uploadedAt(doc.getUploadedAt())
                .build();
    }

    public static AgencyClientResponse toClientResponse(AgencyClient client, long jobCount, long submissionCount) {
        if (client == null) return null;
        return AgencyClientResponse.builder()
                .id(client.getId())
                .agencyId(client.getAgencyId())
                .companyId(client.getCompanyId())
                .companyName(client.getCompanyName())
                .industry(client.getIndustry())
                .website(client.getWebsite())
                .officialEmail(client.getOfficialEmail())
                .contactPerson(client.getContactPerson())
                .contactNumber(client.getContactNumber())
                .address(client.getAddress())
                .country(client.getCountry())
                .state(client.getState())
                .city(client.getCity())
                .pinCode(client.getPinCode())
                .status(client.getStatus())
                .totalJobs(jobCount)
                .totalSubmissions(submissionCount)
                .createdAt(client.getCreatedAt())
                .updatedAt(client.getUpdatedAt())
                .build();
    }

    public static AgencyJobResponse toJobResponse(Job job, String clientCompanyName, long candidateCount, long submissionCount, long placementCount) {
        if (job == null) return null;
        EmploymentType empType = EmploymentType.FULL_TIME;
        if (job.getEmploymentType() != null) {
            try {
                empType = EmploymentType.valueOf(job.getEmploymentType().toUpperCase().replace("-", "_").replace(" ", "_"));
            } catch (Exception ignored) {}
        }
        return AgencyJobResponse.builder()
                .id(job.getId())
                .title(job.getTitle())
                .description(job.getDescription())
                .responsibilities(job.getResponsibilities())
                .additionalRequirements(job.getAdditionalRequirements())
                .agencyId(job.getAgencyId())
                .clientCompanyId(job.getClientCompanyId())
                .clientCompanyName(clientCompanyName)
                .location(job.getLocation())
                .country(job.getCountry())
                .city(job.getCity())
                .workMode(job.getWorkMode())
                .employmentType(empType)
                .techStack(job.getTechStack())
                .preferredSkills(job.getPreferredSkills())
                .minExperienceYears(job.getMinExperienceYears())
                .maxExperienceYears(job.getMaxExperienceYears())
                .minSalaryInr(job.getMinSalaryInr())
                .maxSalaryInr(job.getMaxSalaryInr())
                .educationRequirements(job.getEducationRequirements())
                .numberOfVacancies(job.getNumberOfVacancies())
                .applicationDeadline(job.getApplicationDeadline())
                .status(job.getStatus())
                .candidateCount(candidateCount)
                .submissionCount(submissionCount)
                .placementCount(placementCount)
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .build();
    }

    public static AgencyStaffResponse toStaffResponse(User user) {
        if (user == null) return null;
        return AgencyStaffResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .accountStatus(user.getAccountStatus())
                .agencyId(user.getAgencyId())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
