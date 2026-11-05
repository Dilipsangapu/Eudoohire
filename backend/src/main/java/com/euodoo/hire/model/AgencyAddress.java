package com.euodoo.hire.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyAddress {
    private String country;
    private String state;
    private String city;
    private String district;
    private String officeAddress;
    private String pinCode;
}
