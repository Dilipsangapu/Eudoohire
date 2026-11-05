package com.euodoo.hire.dto.response;

import com.euodoo.hire.model.AgencyClientStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyClientResponse {

    private String id;
    private String agencyId;
    private String companyId;
    private String companyName;
    private String industry;
    private String website;
    private String officialEmail;
    private String contactPerson;
    private String contactNumber;
    private String address;
    private String country;
    private String state;
    private String city;
    private String pinCode;
    private AgencyClientStatus status;
    private long totalJobs;
    private long totalSubmissions;
    private Instant createdAt;
    private Instant updatedAt;
}
