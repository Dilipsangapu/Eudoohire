package com.euodoo.hire.dto.request;

import com.euodoo.hire.model.AgencyType;
import com.euodoo.hire.model.AgencyAddress;
import com.euodoo.hire.model.AgencyRepresentative;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyRegistrationRequest {

    @NotBlank(message = "Agency name is required")
    private String agencyName;

    @NotNull(message = "Agency type is required")
    private AgencyType agencyType;

    private String otherAgencyType;

    @NotBlank(message = "Business registration number is required")
    private String businessRegistrationNumber;

    private Integer establishmentYear;

    private String officeModel;

    private String gstNumber;

    @NotBlank(message = "PAN number is required")
    private String panNumber;

    @NotBlank(message = "Official email is required")
    @Email(message = "Valid email is required")
    private String officialEmail;

    @NotBlank(message = "Password is required")
    private String password;

    @NotBlank(message = "Contact number is required")
    private String contactNumber;

    private String alternateContactNumber;

    private String website;

    private String linkedin;

    @Valid
    private AgencyRepresentative representative;

    @Valid
    private AgencyAddress officeAddress;
}
