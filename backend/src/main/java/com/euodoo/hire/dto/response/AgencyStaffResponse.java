package com.euodoo.hire.dto.response;

import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgencyStaffResponse {

    private String id;
    private String name;
    private String email;
    private Role role;
    private AccountStatus accountStatus;
    private String agencyId;
    private Instant createdAt;
    private Instant updatedAt;
}
