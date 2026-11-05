package com.euodoo.hire.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyRepresentative {
    private String representativeId;
    private String fullName;
    private String designation;
    private String officialEmail;
    private String mobileNumber;
    private String alternateMobileNumber;
    private String linkedin;
}
