package com.euodoo.hire;

import com.euodoo.hire.config.SecurityConfigBeanTest;
import com.euodoo.hire.controller.AuthRestControllerTest;
import com.euodoo.hire.controller.FileControllerTest;
import com.euodoo.hire.model.UserValidationTest;
import com.euodoo.hire.service.AgencyDocumentServiceTest;
import com.euodoo.hire.service.AgencyRegistrationServiceTest;
import com.euodoo.hire.service.AgencyWorkflowIntegrationTest;
import com.euodoo.hire.service.AuthServiceTest;
import com.euodoo.hire.service.CandidateServiceTest;
import com.euodoo.hire.service.CustomUserDetailsServiceTest;
import com.euodoo.hire.service.FileStorageServiceLocalStorageTest;
import com.euodoo.hire.service.ResumeManagementServiceTest;
import com.euodoo.hire.service.ResumePdfServiceTest;
import com.euodoo.hire.service.SubscriptionServiceTest;
import com.euodoo.hire.service.PaymentServiceTest;
import org.junit.jupiter.api.Test;
import org.junit.platform.suite.api.SelectClasses;
import org.junit.platform.suite.api.Suite;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

/**
 * Runs all backend tests: authentication, security, resume management,
 * PDF generation, file storage and candidate business logic.
 */
@Suite
@SelectClasses({
        SecurityConfigBeanTest.class,
        AuthRestControllerTest.class,
        FileControllerTest.class,
        UserValidationTest.class,
        AuthServiceTest.class,
        CandidateServiceTest.class,
        CustomUserDetailsServiceTest.class,
        FileStorageServiceLocalStorageTest.class,
        ResumeManagementServiceTest.class,
        ResumePdfServiceTest.class,
        SubscriptionServiceTest.class,
        PaymentServiceTest.class,
        AgencyDocumentServiceTest.class,
        AgencyRegistrationServiceTest.class,
        AgencyWorkflowIntegrationTest.class,
        HireApplicationTests.SpringContextTest.class,
})
class HireApplicationTests {

    /** Verifies the application context loads. */
    @SpringBootTest
    @TestPropertySource(properties = {
        "spring.data.mongodb.auto-index-creation=false",
        "razorpay.key-id=",
        "razorpay.key-secret=",
        "cloudinary.cloud-name=",
        "cloudinary.api-key=",
        "cloudinary.api-secret=",
        "spring.thymeleaf.check-template-location=false"
    })
    static class SpringContextTest {

        @Test
        void contextLoads() {
        }
    }
}
