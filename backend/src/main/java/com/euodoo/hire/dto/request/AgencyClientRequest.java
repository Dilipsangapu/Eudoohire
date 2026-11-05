package com.euodoo.hire.dto.request;

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
public class AgencyClientRequest {

    private String companyId;

    @NotBlank(message = "Company name is required")
    private String companyName;

    private String industry;

    private String website;

    @Email
    private String officialEmail;

    private String contactPerson;

    private String contactNumber;

    private String address;

    private String country;

    private String state;

    private String city;

    private String pinCode;
}
