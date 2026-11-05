package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyStaffCreateRequest;
import com.euodoo.hire.dto.request.AgencyStaffUpdateRequest;
import com.euodoo.hire.dto.response.AgencyStaffResponse;
import com.euodoo.hire.service.AgencyStaffService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/agency/staff")
@RequiredArgsConstructor
public class AgencyStaffController {

    private final AgencyStaffService staffService;
    private final AgencySecurityUtils securityUtils;

    @PostMapping
    public ResponseEntity<AgencyStaffResponse> addStaff(
            @Valid @RequestBody AgencyStaffCreateRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyStaffResponse response = staffService.addStaff(effectiveAgencyId, request, user.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<AgencyStaffResponse>> getStaff(
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        List<AgencyStaffResponse> response = staffService.getStaff(effectiveAgencyId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AgencyStaffResponse> updateStaff(
            @PathVariable String id,
            @Valid @RequestBody AgencyStaffUpdateRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyStaffResponse response = staffService.updateStaff(effectiveAgencyId, id, request, user.getId());
        return ResponseEntity.ok(response);
    }
}
