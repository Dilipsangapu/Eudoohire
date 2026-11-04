package com.euodoo.hire.service;

import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.model.*;
import com.euodoo.hire.repository.CandidateProfileRepository;
import com.euodoo.hire.repository.RecruiterProfileRepository;
import com.euodoo.hire.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AuthService.
 * All external dependencies are mocked.
 */
@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private CandidateProfileRepository candidateProfileRepository;

    @Mock
    private RecruiterProfileRepository recruiterProfileRepository;

    @Mock
    private com.euodoo.hire.repository.CompanyRepository companyRepository;

    private PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4); // Low rounds for test speed

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, candidateProfileRepository,
                recruiterProfileRepository, companyRepository, passwordEncoder);
    }

    // =========================================================
    // Candidate registration
    // =========================================================

    @Test
    void registerCandidate_success() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("user-001");
            return u;
        });
        when(candidateProfileRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User result = authService.registerCandidate("Alice", "Alice@Example.com", "SecurePass1!");

        assertEquals("alice@example.com", result.getEmail()); // Normalized
        assertEquals(Role.CANDIDATE, result.getRole());
        assertEquals(AccountStatus.PENDING_APPROVAL, result.getAccountStatus());
        assertEquals(PlanType.FREE, result.getPlan());
        assertFalse(result.isPlanActivated());
        assertNotNull(result.getPasswordHash());
        assertFalse(result.getPasswordHash().equals("SecurePass1!")); // BCrypt hash, not plaintext
        assertTrue(passwordEncoder.matches("SecurePass1!", result.getPasswordHash()));
    }

    @Test
    void registerCandidate_duplicateEmail_throwsBusinessException() {
        when(userRepository.existsByEmail("duplicate@example.com")).thenReturn(true);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> authService.registerCandidate("Bob", "Duplicate@Example.com", "Pass123!"));

        assertEquals("DUPLICATE_EMAIL", ex.getErrorCode());
    }

    @Test
    void registerCandidate_emailNormalization() {
        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(candidateProfileRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User result = authService.registerCandidate("Test", "  TEST@EXAMPLE.COM  ", "Password1!");
        assertEquals("test@example.com", result.getEmail());
    }

    @Test
    void registerCandidate_roleIsAlwaysCandidate() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(candidateProfileRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User result = authService.registerCandidate("Eve", "eve@example.com", "Test1234!");
        assertEquals(Role.CANDIDATE, result.getRole());
        // No CLIENT_ADMIN or RECRUITER roles can be self-assigned
    }

    // =========================================================
    // Recruiter registration
    // =========================================================

    @Test
    void registerRecruiter_success() {
        when(userRepository.existsByEmail("recruiter@company.com")).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId("rec-001");
            return u;
        });
        when(recruiterProfileRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User result = authService.registerRecruiter(
                "Bob Recruiter", "recruiter@company.com", "RecPass123!", "Senior HR", "+91-9000000000");

        assertEquals(Role.RECRUITER, result.getRole());
        assertEquals(AccountStatus.PENDING_APPROVAL, result.getAccountStatus());
        assertEquals("recruiter@company.com", result.getEmail());
    }

    @Test
    void registerRecruiter_duplicateEmail_throwsBusinessException() {
        when(userRepository.existsByEmail("taken@company.com")).thenReturn(true);

        assertThrows(BusinessException.class,
                () -> authService.registerRecruiter("Bob", "taken@company.com", "Pass!", "HR", null));
    }

    // =========================================================
    // Password hashing
    // =========================================================

    @Test
    void passwordIsHashed_notStoredPlaintext() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(candidateProfileRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User user = authService.registerCandidate("Hash Test", "hash@test.com", "MyPassword123!");
        assertNotEquals("MyPassword123!", user.getPasswordHash());
        assertTrue(user.getPasswordHash().startsWith("$2a$") || user.getPasswordHash().startsWith("$2b$"));
    }
}
