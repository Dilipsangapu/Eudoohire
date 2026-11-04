package com.euodoo.hire.service;

import com.euodoo.hire.exception.AgencyExceptions.UnauthorizedAgencyAccessException;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AgencySecurityUtils {

    private final UserRepository userRepository;

    public User getAuthenticatedUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            throw new UnauthorizedAgencyAccessException("Authentication is required to perform this action");
        }
        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new UnauthorizedAgencyAccessException("Authenticated user not found: " + auth.getName()));
    }

    public String resolveAgencyId(String explicitAgencyId) {
        User user = getAuthenticatedUser();
        if (user.getRole() == Role.CLIENT_ADMIN || user.getRole() == Role.ADMIN || user.getRole() == Role.SUPER_ADMIN) {
            if (explicitAgencyId != null && !explicitAgencyId.isBlank()) {
                return explicitAgencyId;
            }
            if (user.getAgencyId() != null) {
                return user.getAgencyId();
            }
            throw new UnauthorizedAgencyAccessException("Admin must specify an agency ID for this operation");
        }

        if (user.getAgencyId() == null || user.getAgencyId().isBlank()) {
            throw new UnauthorizedAgencyAccessException("User is not associated with any registered agency");
        }

        if (explicitAgencyId != null && !explicitAgencyId.isBlank() && !explicitAgencyId.equals(user.getAgencyId())) {
            throw new UnauthorizedAgencyAccessException("Access denied: You cannot access or modify another agency's data");
        }

        return user.getAgencyId();
    }
}
