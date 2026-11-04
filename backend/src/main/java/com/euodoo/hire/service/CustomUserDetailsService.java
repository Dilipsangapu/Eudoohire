package com.euodoo.hire.service;

import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;


@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        String normalizedEmail = email.trim().toLowerCase();

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "No account found for email: " + normalizedEmail));

        // Translate account status to Spring Security flags
        boolean enabled = user.getAccountStatus() == AccountStatus.ACTIVE;
        boolean nonLocked = user.getAccountStatus() != AccountStatus.DISABLED
                && user.getAccountStatus() != AccountStatus.REJECTED;

        // For PENDING users, set non-locked=false so Spring Security rejects them
        // with a LockedException, which the auth failure handler can detect
        if (user.getAccountStatus() == AccountStatus.PENDING_APPROVAL) {
            nonLocked = false;
        }

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                enabled,   // enabled
                true,      // accountNonExpired
                true,      // credentialsNonExpired
                nonLocked, // accountNonLocked
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }
}
