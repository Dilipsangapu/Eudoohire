package com.euodoo.hire.dto.response;

import com.euodoo.hire.model.AgencyRegistrationStatus;
import com.euodoo.hire.model.AgencyType;
import com.euodoo.hire.model.AgencyAddress;
import com.euodoo.hire.model.AgencyRepresentative;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyResponse {

    private String id;
    private String agencyName;
    private AgencyType agencyType;
    private String otherAgencyType;
    private String businessRegistrationNumber;
    private String gstNumber;
    private String panNumber;
    private String officialEmail;
    private String contactNumber;
    private String alternateContactNumber;
    private String website;
    private AgencyRepresentative representative;
    private AgencyAddress officeAddress;
    private Instant registrationDate;
    private AgencyRegistrationStatus registrationStatus;
    private String registeredUserId;
    private String reviewedByAdminId;
    private String rejectionReason;
    private String verificationRemarks;
    private Instant submittedAt;
    private Instant reviewedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
