package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyPlacementRequest;
import com.euodoo.hire.dto.response.AgencyPlacementResponse;
import com.euodoo.hire.model.PlacementStatus;
import com.euodoo.hire.service.AgencyPlacementService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/agency/placements")
@RequiredArgsConstructor
public class AgencyPlacementController {

    private final AgencyPlacementService placementService;
    private final AgencySecurityUtils securityUtils;

    @PostMapping
    public ResponseEntity<AgencyPlacementResponse> createPlacement(
            @Valid @RequestBody AgencyPlacementRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyPlacementResponse response = placementService.createPlacement(effectiveAgencyId, user.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<AgencyPlacementResponse>> getPlacements(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) PlacementStatus status,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        Page<AgencyPlacementResponse> response = placementService.getPlacements(effectiveAgencyId, page, size, status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgencyPlacementResponse> getPlacement(
            @PathVariable String id,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyPlacementResponse response = placementService.getPlacement(effectiveAgencyId, id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/confirm")
    public ResponseEntity<AgencyPlacementResponse> confirmPlacement(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        String remarks = body != null ? body.get("remarks") : "Placement confirmed";
        AgencyPlacementResponse response = placementService.confirmPlacement(effectiveAgencyId, id, remarks, user.getId());
        return ResponseEntity.ok(response);
    }
}
