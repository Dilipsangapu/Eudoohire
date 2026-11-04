package com.euodoo.hire.dto.request;

import com.euodoo.hire.model.AccountStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyStaffUpdateRequest {

    private String name;

    private String phone;

    private AccountStatus status;
}
