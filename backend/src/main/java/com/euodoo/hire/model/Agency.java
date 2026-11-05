package com.euodoo.hire.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "agencies")
public class Agency {

    @Id
    private String id;

    @Indexed
    private String agencyName;

    @Builder.Default
    private AgencyType agencyType = AgencyType.RECRUITMENT_AGENCY;

    private String otherAgencyType;

    @Indexed
    private String businessRegistrationNumber;

    private Integer establishmentYear;

    private String officeModel;

    private String gstNumber;

    private String panNumber;

    @Indexed(unique = true)
    private String officialEmail;

    private String contactNumber;

    private String contactCountryCode;

    private String alternateContactNumber;

    private String alternateContactCountryCode;

    private String website;

    private String linkedin;

    private AgencyRepresentative representative;

    private AgencyAddress officeAddress;

    private Instant registrationDate;

    @Builder.Default
    @Indexed
    private AgencyRegistrationStatus registrationStatus = AgencyRegistrationStatus.DRAFT;

    /** User ID of the primary administrator / registrant for this agency. */
    @Indexed
    private String registeredUserId;

    private String reviewedByAdminId;

    private String rejectionReason;

    private String verificationRemarks;

    private Instant submittedAt;

    private Instant reviewedAt;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
