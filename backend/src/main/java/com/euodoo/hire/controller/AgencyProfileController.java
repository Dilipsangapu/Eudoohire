package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyUpdateRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.service.AgencyProfileService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/agencies/profile")
@RequiredArgsConstructor
public class AgencyProfileController {

    private final AgencyProfileService profileService;
    private final AgencySecurityUtils securityUtils;

    @GetMapping
    public ResponseEntity<AgencyResponse> getProfile(@RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyResponse response = profileService.getProfile(effectiveAgencyId);
        return ResponseEntity.ok(response);
    }

    @PutMapping
    public ResponseEntity<AgencyResponse> updateProfile(
            @RequestParam(required = false) String agencyId,
            @Valid @RequestBody AgencyUpdateRequest request) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyResponse response = profileService.updateProfile(effectiveAgencyId, request, user.getId());
        return ResponseEntity.ok(response);
    }
}
