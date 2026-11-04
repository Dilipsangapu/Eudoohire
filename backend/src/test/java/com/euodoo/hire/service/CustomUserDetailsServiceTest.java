package com.euodoo.hire.service;

import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.PlanType;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link CustomUserDetailsService} — Spring Security account
 * loading: email normalization, account-status → flags mapping, and role
 * authority generation ("ROLE_" + enum name).
 */
@ExtendWith(MockitoExtension.class)
public class CustomUserDetailsServiceTest {

    @Mock
    private UserRepository userRepository;

    private CustomUserDetailsService service;

    @BeforeEach
    void setUp() {
        service = new CustomUserDetailsService(userRepository);
    }

    private User user(AccountStatus status, Role role) {
        String key = role.name().toLowerCase().replace("_", "");
        return User.builder()
                .id("u-1")
                .name("Test " + key)
                .email("person@" + key + ".dev")
                .passwordHash("$2a$12$stubhashvalue0000000000000000000000000000000000000000")
                .role(role)
                .accountStatus(status)
                .plan(PlanType.FREE)
                .build();
    }

    @Test
    @DisplayName("loadUserByUsername: trims and lowercases the email before lookup")
    void loadNormalizesEmail() {
        when(userRepository.findByEmail("person@candidate.dev"))
                .thenReturn(Optional.of(user(AccountStatus.ACTIVE, Role.CANDIDATE)));

        service.loadUserByUsername("  PERSON@Candidate.dev ");

        verify(userRepository).findByEmail("person@candidate.dev");
    }

    @Test
    @DisplayName("loadUserByUsername: unknown email → UsernameNotFoundException")
    void loadUnknownEmail_throws() {
        when(userRepository.findByEmail("ghost@euodoo.dev")).thenReturn(Optional.empty());

        assertThrows(UsernameNotFoundException.class,
                () -> service.loadUserByUsername("ghost@euodoo.dev"));
    }

    @Test
    @DisplayName("ACTIVE user: enabled, unlocked, ROLE_ authority from the enum")
    void activeUser_flagsAndAuthority() {
        when(userRepository.findByEmail("person@recruiter.dev"))
                .thenReturn(Optional.of(user(AccountStatus.ACTIVE, Role.RECRUITER)));

        UserDetails details = service.loadUserByUsername("person@recruiter.dev");

        assertTrue(details.isEnabled());
        assertTrue(details.isAccountNonLocked());
        assertTrue(details.isAccountNonExpired());
        assertTrue(details.isCredentialsNonExpired());
        List<String> authorities = details.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority).toList();
        assertEquals(List.of("ROLE_RECRUITER"), authorities);
        assertEquals("$2a$12$stubhashvalue0000000000000000000000000000000000000000",
                details.getPassword());
    }

    @Test
    @DisplayName("PENDING_APPROVAL user: locked AND disabled (surfaces LockedException in the chain)")
    void pendingUser_lockedAndDisabled() {
        when(userRepository.findByEmail("person@candidate.dev"))
                .thenReturn(Optional.of(user(AccountStatus.PENDING_APPROVAL, Role.CANDIDATE)));

        UserDetails details = service.loadUserByUsername("person@candidate.dev");

        assertFalse(details.isEnabled(), "pending approval must not be a usable login");
        assertFalse(details.isAccountNonLocked(), "pending must surface as locked, not just disabled");
    }

    @Test
    @DisplayName("REJECTED user: disabled and locked")
    void rejectedUser_disabled() {
        when(userRepository.findByEmail("person@candidate.dev"))
                .thenReturn(Optional.of(user(AccountStatus.REJECTED, Role.CANDIDATE)));

        UserDetails details = service.loadUserByUsername("person@candidate.dev");

        assertFalse(details.isEnabled());
        assertFalse(details.isAccountNonLocked());
    }

    @Test
    @DisplayName("DISABLED user: disabled and locked")
    void disabledUser_disabled() {
        when(userRepository.findByEmail("person@companyadmin.dev"))
                .thenReturn(Optional.of(user(AccountStatus.DISABLED, Role.CLIENT_ADMIN)));

        UserDetails details = service.loadUserByUsername("person@companyadmin.dev");

        assertFalse(details.isEnabled());
        assertFalse(details.isAccountNonLocked());
    }

    @Test
    @DisplayName("CLIENT_ADMIN maps its own authority string; no cross-role leakage")
    void adminAuthority_mapping() {
        when(userRepository.findByEmail("person@companyadmin.dev"))
                .thenReturn(Optional.of(user(AccountStatus.ACTIVE, Role.CLIENT_ADMIN)));

        UserDetails details = service.loadUserByUsername("person@companyadmin.dev");

        List<String> authorities = details.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority).toList();
        assertEquals(List.of("ROLE_CLIENT_ADMIN"), authorities);
        assertTrue(authorities.stream().noneMatch(a -> a.contains("CANDIDATE") || a.contains("RECRUITER")));
    }

    @Test
    @DisplayName("email lookup is exact-match, not contains (passes through notes)")
    void loadUsesExactEmailMatch() {
        when(userRepository.findByEmail("person@candidate.dev"))
                .thenReturn(Optional.of(user(AccountStatus.ACTIVE, Role.CANDIDATE)));

        UserDetails details = service.loadUserByUsername("person@candidate.dev");
        assertEquals("person@candidate.dev", details.getUsername());
    }
}
