package com.euodoo.hire.controller;

import com.euodoo.hire.dto.request.AgencyRegistrationRequest;
import com.euodoo.hire.dto.response.AgencyResponse;
import com.euodoo.hire.model.AgencyAddress;
import com.euodoo.hire.model.AgencyRepresentative;
import com.euodoo.hire.model.AgencyType;
import com.euodoo.hire.service.AgencyRegistrationService;
import com.euodoo.hire.service.AgencySecurityUtils;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockMultipartHttpServletRequest;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AgencyRegistrationControllerTest {

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

    @Mock
    private AgencyRegistrationService registrationService;

    @Mock
    private AgencySecurityUtils securityUtils;

    private Validator validator;
    private AgencyRegistrationController controller;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
        controller = new AgencyRegistrationController(registrationService, securityUtils, validator);
    }

    private AgencyRegistrationRequest buildValidRequest() {
        return AgencyRegistrationRequest.builder()
                .agencyName("Test Tech Recruiting")
                .agencyType(AgencyType.RECRUITMENT_AGENCY)
                .businessRegistrationNumber("REG123456")
                .establishmentYear(2020)
                .officeModel("Physical Office")
                .panNumber("ABCDE1234F")
                .officialEmail("testagency@example.com")
                .password("SecureP@ss123")
                .contactNumber("9876543210")
                .contactCountryCode("+91")
                .alternateContactNumber("9876543211")
                .alternateContactCountryCode("+91")
                .representative(AgencyRepresentative.builder()
                        .fullName("John Doe")
                        .designation("Director")
                        .officialEmail("john@example.com")
                        .mobileNumber("9876543210")
                        .mobileCountryCode("+91")
                        .alternateMobileNumber("9876543211")
                        .alternateMobileCountryCode("+91")
                        .build())
                .officeAddress(AgencyAddress.builder()
                        .country("India")
                        .state("Maharashtra")
                        .city("Mumbai")
                        .officeAddress("123 Marine Drive")
                        .pinCode("400001")
                        .build())
                .build();
    }

    @Test
    @DisplayName("registerMultipart: successfully handles 'data' passed as regular form text parameter")
    void registerMultipart_withDataStringParameter() throws Exception {
        AgencyRegistrationRequest req = buildValidRequest();
        String json = JSON_MAPPER.writeValueAsString(req);

        MockMultipartHttpServletRequest mockRequest = new MockMultipartHttpServletRequest();
        mockRequest.setParameter("data", json);

        MockMultipartFile incFile = new MockMultipartFile("incorporationFile", "inc.pdf", "application/pdf", "dummy pdf content".getBytes(StandardCharsets.UTF_8));
        mockRequest.addFile(incFile);

        when(registrationService.registerAgency(any(AgencyRegistrationRequest.class), any(MultipartFile.class), any()))
                .thenReturn(AgencyResponse.builder().id("agency-1").agencyName(req.getAgencyName()).contactCountryCode("+91").build());

        ResponseEntity<AgencyResponse> response = controller.registerMultipart(incFile, null, mockRequest);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("agency-1", response.getBody().getId());

        ArgumentCaptor<AgencyRegistrationRequest> captor = ArgumentCaptor.forClass(AgencyRegistrationRequest.class);
        verify(registrationService).registerAgency(captor.capture(), eq(incFile), isNull());
        assertEquals("Test Tech Recruiting", captor.getValue().getAgencyName());
        assertEquals("+91", captor.getValue().getContactCountryCode());
        assertEquals("+91", captor.getValue().getAlternateContactCountryCode());
        assertEquals("+91", captor.getValue().getRepresentative().getMobileCountryCode());
    }

    @Test
    @DisplayName("registerMultipart: successfully handles 'data' uploaded as Blob/File part (StandardMultipartFile)")
    void registerMultipart_withDataFilePart() throws Exception {
        AgencyRegistrationRequest req = buildValidRequest();
        String json = JSON_MAPPER.writeValueAsString(req);

        MockMultipartHttpServletRequest mockRequest = new MockMultipartHttpServletRequest();
        MockMultipartFile dataFile = new MockMultipartFile("data", "blob", "application/json", json.getBytes(StandardCharsets.UTF_8));
        mockRequest.addFile(dataFile);

        MockMultipartFile incFile = new MockMultipartFile("incorporationFile", "inc.pdf", "application/pdf", "inc data".getBytes(StandardCharsets.UTF_8));
        MockMultipartFile gstFile = new MockMultipartFile("gstFile", "gst.pdf", "application/pdf", "gst data".getBytes(StandardCharsets.UTF_8));
        mockRequest.addFile(incFile);
        mockRequest.addFile(gstFile);

        when(registrationService.registerAgency(any(AgencyRegistrationRequest.class), any(MultipartFile.class), any(MultipartFile.class)))
                .thenReturn(AgencyResponse.builder().id("agency-2").agencyName(req.getAgencyName()).build());

        ResponseEntity<AgencyResponse> response = controller.registerMultipart(incFile, gstFile, mockRequest);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("agency-2", response.getBody().getId());

        ArgumentCaptor<AgencyRegistrationRequest> captor = ArgumentCaptor.forClass(AgencyRegistrationRequest.class);
        verify(registrationService).registerAgency(captor.capture(), eq(incFile), eq(gstFile));
        assertEquals("Test Tech Recruiting", captor.getValue().getAgencyName());
        assertEquals("+91", captor.getValue().getRepresentative().getMobileCountryCode());
    }
}
