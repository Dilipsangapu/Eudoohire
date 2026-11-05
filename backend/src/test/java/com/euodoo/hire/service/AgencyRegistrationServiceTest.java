package com.euodoo.hire.service;

import com.euodoo.hire.dto.request.AgencyDraftRequest;
import com.euodoo.hire.dto.request.AgencyRegistrationRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.model.AgencyRegistrationStatus;
import com.euodoo.hire.model.AgencyType;
import com.euodoo.hire.exception.AgencyExceptions.AgencyAlreadyExistsException;
import com.euodoo.hire.model.Agency;
import com.euodoo.hire.model.AgencyAddress;
import com.euodoo.hire.model.AgencyRepresentative;
import com.euodoo.hire.repository.AgencyRepository;
import com.euodoo.hire.service.AgencyRegistrationService;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import com.euodoo.hire.repository.UserRepository;
import com.euodoo.hire.service.AuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AgencyRegistrationServiceTest {

    @Mock
    private AgencyRepository agencyRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuditService auditService;

    @Mock
    private AgencyDocumentService agencyDocumentService;

    @InjectMocks
    private AgencyRegistrationService registrationService;

    private AgencyRegistrationRequest registrationRequest;

    @BeforeEach
    void setUp() {
        registrationRequest = AgencyRegistrationRequest.builder()
                .agencyName("Global Talent Corp")
                .agencyType(AgencyType.RECRUITMENT_AGENCY)
                .businessRegistrationNumber("CIN123456789")
                .gstNumber("29ABCDE1234F1Z5")
                .panNumber("ABCDE1234F")
                .officialEmail("contact@globaltalent.com")
                .password("SecurePass@123")
                .contactNumber("+91-9876543210")
                .representative(AgencyRepresentative.builder()
                        .fullName("Anil Sharma")
                        .designation("CEO")
                        .officialEmail("anil@globaltalent.com")
                        .mobileNumber("+91-9876543210")
                        .build())
                .officeAddress(AgencyAddress.builder()
                        .country("India")
                        .state("Maharashtra")
                        .city("Mumbai")
                        .officeAddress("101 Nariman Point")
                        .pinCode("400021")
                        .build())
                .build();
    }

    @Test
    @DisplayName("registerAgency: creates User and Agency with status SUBMITTED")
    void registerAgency_success() {
        when(agencyRepository.existsByOfficialEmailIgnoreCase("contact@globaltalent.com")).thenReturn(false);
        when(userRepository.existsByEmail("contact@globaltalent.com")).thenReturn(false);
        when(agencyRepository.existsByBusinessRegistrationNumber("CIN123456789")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_password");

        User savedUser = User.builder()
                .id("user-123")
                .email("contact@globaltalent.com")
                .role(Role.AGENCY_ADMIN)
                .build();
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        Agency savedAgency = Agency.builder()
                .id("agency-123")
                .agencyName("Global Talent Corp")
                .officialEmail("contact@globaltalent.com")
                .registrationStatus(AgencyRegistrationStatus.SUBMITTED)
                .registeredUserId("user-123")
                .registrationDate(Instant.now())
                .build();
        when(agencyRepository.save(any(Agency.class))).thenReturn(savedAgency);

        AgencyResponse response = registrationService.registerAgency(registrationRequest);

        assertNotNull(response);
        assertEquals("agency-123", response.getId());
        assertEquals("Global Talent Corp", response.getAgencyName());
        assertEquals(AgencyRegistrationStatus.SUBMITTED, response.getRegistrationStatus());
        verify(agencyRepository, times(1)).save(any(Agency.class));
    }

    @Test
    @DisplayName("registerAgency: with documents uploads certificates and links to agency")
    void registerAgency_withDocuments_success() {
        when(agencyRepository.existsByOfficialEmailIgnoreCase("contact@globaltalent.com")).thenReturn(false);
        when(userRepository.existsByEmail("contact@globaltalent.com")).thenReturn(false);
        when(agencyRepository.existsByBusinessRegistrationNumber("CIN123456789")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_password");

        User savedUser = User.builder()
                .id("user-123")
                .email("contact@globaltalent.com")
                .role(Role.AGENCY_ADMIN)
                .build();
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        Agency savedAgency = Agency.builder()
                .id("agency-123")
                .agencyName("Global Talent Corp")
                .officialEmail("contact@globaltalent.com")
                .registrationStatus(AgencyRegistrationStatus.SUBMITTED)
                .registeredUserId("user-123")
                .registrationDate(Instant.now())
                .build();
        when(agencyRepository.save(any(Agency.class))).thenReturn(savedAgency);

        org.springframework.mock.web.MockMultipartFile incFile = new org.springframework.mock.web.MockMultipartFile(
                "incorporationFile", "inc.pdf", "application/pdf", "%PDF-1.4 test".getBytes());
        org.springframework.mock.web.MockMultipartFile gstFile = new org.springframework.mock.web.MockMultipartFile(
                "gstFile", "gst.pdf", "application/pdf", "%PDF-1.4 test".getBytes());

        AgencyResponse response = registrationService.registerAgency(registrationRequest, incFile, gstFile);

        assertNotNull(response);
        assertEquals("agency-123", response.getId());
        verify(agencyDocumentService, times(1)).uploadDocument(
                eq("agency-123"), eq(com.euodoo.hire.model.AgencyDocumentType.COMPANY_REGISTRATION_CERTIFICATE), eq(incFile), eq("user-123"));
        verify(agencyDocumentService, times(1)).uploadDocument(
                eq("agency-123"), eq(com.euodoo.hire.model.AgencyDocumentType.GST_CERTIFICATE), eq(gstFile), eq("user-123"));
    }

    @Test
    @DisplayName("registerAgency: duplicate email throws AgencyAlreadyExistsException")
    void registerAgency_duplicateEmail() {
        when(agencyRepository.existsByOfficialEmailIgnoreCase("contact@globaltalent.com")).thenReturn(true);

        assertThrows(AgencyAlreadyExistsException.class, () ->
                registrationService.registerAgency(registrationRequest));
        verify(agencyRepository, never()).save(any(Agency.class));
    }

    @Test
    @DisplayName("saveDraft: saves new agency in DRAFT status")
    void saveDraft_success() {
        AgencyDraftRequest draft = AgencyDraftRequest.builder()
                .officialEmail("draft@agency.com")
                .agencyName("Draft Agency")
                .build();

        when(agencyRepository.findByOfficialEmailIgnoreCase("draft@agency.com")).thenReturn(Optional.empty());

        Agency saved = Agency.builder()
                .id("agency-draft-1")
                .agencyName("Draft Agency")
                .officialEmail("draft@agency.com")
                .registrationStatus(AgencyRegistrationStatus.DRAFT)
                .build();
        when(agencyRepository.save(any(Agency.class))).thenReturn(saved);

        AgencyResponse response = registrationService.saveDraft(draft);

        assertNotNull(response);
        assertEquals(AgencyRegistrationStatus.DRAFT, response.getRegistrationStatus());
    }
}
