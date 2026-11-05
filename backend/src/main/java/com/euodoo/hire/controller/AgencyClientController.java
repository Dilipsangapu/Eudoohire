package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyClientRequest;
import com.euodoo.hire.dto.response.AgencyClientResponse;
import com.euodoo.hire.model.AgencyClientStatus;
import com.euodoo.hire.service.AgencyClientService;
import com.euodoo.hire.service.AgencySecurityUtils;
import com.euodoo.hire.model.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/agency/clients")
@RequiredArgsConstructor
public class AgencyClientController {

    private final AgencyClientService clientService;
    private final AgencySecurityUtils securityUtils;

    @PostMapping
    public ResponseEntity<AgencyClientResponse> addClient(
            @Valid @RequestBody AgencyClientRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyClientResponse response = clientService.addClient(effectiveAgencyId, request, user.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<AgencyClientResponse>> getClients(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) AgencyClientStatus status,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        Page<AgencyClientResponse> response = clientService.getClients(effectiveAgencyId, page, size, search, status);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgencyClientResponse> getClient(
            @PathVariable String id,
            @RequestParam(required = false) String agencyId) {
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyClientResponse response = clientService.getClient(effectiveAgencyId, id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AgencyClientResponse> updateClient(
            @PathVariable String id,
            @Valid @RequestBody AgencyClientRequest request,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyClientResponse response = clientService.updateClient(effectiveAgencyId, id, request, user.getId());
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AgencyClientResponse> updateStatus(
            @PathVariable String id,
            @RequestParam AgencyClientStatus status,
            @RequestParam(required = false) String agencyId) {
        User user = securityUtils.getAuthenticatedUser();
        String effectiveAgencyId = securityUtils.resolveAgencyId(agencyId);
        AgencyClientResponse response = clientService.updateStatus(effectiveAgencyId, id, status, user.getId());
        return ResponseEntity.ok(response);
    }
}
