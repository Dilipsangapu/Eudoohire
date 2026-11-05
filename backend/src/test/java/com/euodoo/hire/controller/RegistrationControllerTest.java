package com.euodoo.hire.controller;

import com.euodoo.hire.controller.RegistrationController.RecruiterRegistrationRequest;
import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RegistrationControllerTest {

    @Mock
    private AuthService authService;

    private RegistrationController controller;

    @BeforeEach
    void setUp() {
        controller = new RegistrationController(authService);
    }

    @Test
    @DisplayName("registerRecruiter: successfully registers recruiter with all company and professional fields")
    void registerRecruiter_success() {
        RecruiterRegistrationRequest request = new RecruiterRegistrationRequest(
                "Sarah Jenkins",
                null,
                "sarah@techcorp.com",
                "StrongP@ss123",
                "HR Manager",
                "Human Resources",
                "+919876543210",
                "TechCorp Solutions",
                "Private Limited",
                "51-200",
                "https://www.techcorp.com",
                "U72200MH2020PTC123456"
        );

        User mockUser = User.builder()
                .id("user-rec-1")
                .name("Sarah Jenkins")
                .email("sarah@techcorp.com")
                .role(Role.RECRUITER)
                .accountStatus(AccountStatus.PENDING_APPROVAL)
                .build();

        when(authService.registerRecruiter(
                eq("Sarah Jenkins"),
                eq("sarah@techcorp.com"),
                eq("StrongP@ss123"),
                eq("HR Manager"),
                eq("Human Resources"),
                eq("+919876543210")
        )).thenReturn(mockUser);

        ResponseEntity<Map<String, Object>> response = controller.registerRecruiter(request);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("user-rec-1", response.getBody().get("userId"));
        assertEquals("sarah@techcorp.com", response.getBody().get("email"));
        assertEquals("PENDING_APPROVAL", response.getBody().get("status"));

        verify(authService).linkRecruiterCompany(
                eq("user-rec-1"),
                eq("TechCorp Solutions"),
                eq("https://www.techcorp.com"),
                eq("Private Limited"),
                eq("51-200"),
                eq("U72200MH2020PTC123456")
        );
    }

    @Test
    @DisplayName("registerRecruiter: fallback to standard email when workEmail is empty")
    void registerRecruiter_fallbackEmail() {
        RecruiterRegistrationRequest request = new RecruiterRegistrationRequest(
                "Alex Hunter",
                "alex@agency.com",
                null,
                "StrongP@ss123",
                "Lead Talent Partner",
                "Talent Acquisition",
                "+19876543210",
                "Hunter Search Group",
                "LLP",
                "11-50",
                "https://hunter.com",
                null
        );

        User mockUser = User.builder()
                .id("user-rec-2")
                .name("Alex Hunter")
                .email("alex@agency.com")
                .role(Role.RECRUITER)
                .accountStatus(AccountStatus.PENDING_APPROVAL)
                .build();

        when(authService.registerRecruiter(any(), eq("alex@agency.com"), any(), any(), any(), any()))
                .thenReturn(mockUser);

        ResponseEntity<Map<String, Object>> response = controller.registerRecruiter(request);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals("alex@agency.com", response.getBody().get("email"));
    }
}
