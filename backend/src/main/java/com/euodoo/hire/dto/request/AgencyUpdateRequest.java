package com.euodoo.hire.dto.request;

import com.euodoo.hire.model.AgencyType;
import com.euodoo.hire.model.AgencyAddress;
import com.euodoo.hire.model.AgencyRepresentative;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyUpdateRequest {

    private String agencyName;

    private AgencyType agencyType;

    private String otherAgencyType;

    private String contactNumber;

    private String alternateContactNumber;

    private String website;

    private AgencyRepresentative representative;

    private AgencyAddress officeAddress;
}
