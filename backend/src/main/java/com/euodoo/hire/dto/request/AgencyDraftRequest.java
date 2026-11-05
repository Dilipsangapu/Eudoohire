package com.euodoo.hire.dto.request;

import com.euodoo.hire.model.AgencyType;
import com.euodoo.hire.model.AgencyAddress;
import com.euodoo.hire.model.AgencyRepresentative;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyDraftRequest {

    private String id;

    private String agencyName;

    private AgencyType agencyType;

    private String otherAgencyType;

    private String businessRegistrationNumber;

    private Integer establishmentYear;

    private String officeModel;

    private String gstNumber;

    private String panNumber;

    @NotBlank(message = "Official email is required to save a draft")
    @Email(message = "Valid email is required")
    private String officialEmail;

    private String password;

    private String contactNumber;

    private String alternateContactNumber;

    private String website;

    private String linkedin;

    private AgencyRepresentative representative;

    private AgencyAddress officeAddress;
}
