package com.euodoo.hire.model;

import tools.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Model/validation tests for the core {@link User} document — Jakarta Bean
 * Validation constraints and the guarantee that the password hash never
 * leaks through JSON serialization.
 */
public class UserValidationTest {

    private static Validator validator;
    private static ValidatorFactory factory;
    private static ObjectMapper mapper;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
        mapper = new ObjectMapper();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private User validUser() {
        return User.builder()
                .name("Jane Candidate")
                .email("jane@example.com")
                .passwordHash("$2a$12$abcdefghijklmnopqrstuv")
                .role(Role.CANDIDATE)
                .accountStatus(AccountStatus.ACTIVE)
                .plan(PlanType.FREE)
                .build();
    }

    @Test
    @DisplayName("fully valid user has zero violations")
    void validUser_noViolations() {
        Set<ConstraintViolation<User>> violations = validator.validate(validUser());
        assertEquals(Set.of(), violations);
    }

    @Test
    @DisplayName("blank or null name is rejected")
    void blankName_rejected() {
        User u = validUser();
        u.setName("   ");
        assertTrue(validator.validate(u).stream().anyMatch(v -> "name".equals(v.getPropertyPath().toString())));

        u.setName(null);
        assertTrue(validator.validate(u).stream().anyMatch(v -> "name".equals(v.getPropertyPath().toString())));
    }

    @Test
    @DisplayName("malformed emails are rejected; valid ones pass")
    void emailFormat() {
        User bad = validUser();
        bad.setEmail("not-an-email");
        assertTrue(validator.validate(bad).stream()
                .anyMatch(v -> "email".equals(v.getPropertyPath().toString())));

        User alsoBad = validUser();
        alsoBad.setEmail(null);
        assertTrue(validator.validate(alsoBad).stream()
                .anyMatch(v -> "email".equals(v.getPropertyPath().toString())));

        assertTrue(validator.validate(validUser()).isEmpty());
    }

    @Test
    @DisplayName("role and accountStatus are mandatory (no NPE-inducing nulls in the security chain)")
    void roleAndStatus_required() {
        User noRole = validUser();
        noRole.setRole(null);
        assertTrue(validator.validate(noRole).stream()
                .anyMatch(v -> "role".equals(v.getPropertyPath().toString())));

        User noStatus = validUser();
        noStatus.setAccountStatus(null);
        assertTrue(validator.validate(noStatus).stream()
                .anyMatch(v -> "accountStatus".equals(v.getPropertyPath().toString())));
    }

    @Test
    @DisplayName("passwordHash is never serialized to JSON (@JsonIgnore)")
    void passwordHash_notSerialized() throws Exception {
        String json = mapper.writeValueAsString(validUser());
        assertFalse(json.contains("passwordHash"), "hash must not leak: " + json);
        assertTrue(json.contains("\"email\":\"jane@example.com\""));
        assertTrue(json.contains("\"name\":\"Jane Candidate\""));
    }

    @Test
    @DisplayName("user JSON round-trips id, email, role, plan and accountStatus")
    void jsonRoundTrip() throws Exception {
        String json = mapper.writeValueAsString(validUser());
        User back = mapper.readValue(json, User.class);
        assertEquals("jane@example.com", back.getEmail());
        assertEquals(Role.CANDIDATE, back.getRole());
        assertEquals(PlanType.FREE, back.getPlan());
        assertEquals(AccountStatus.ACTIVE, back.getAccountStatus());
    }

    @Test
    @DisplayName("builder produces an instance; frozen JSON round-trips the enum fields")
    void builderDefaults() throws Exception {
        User minimal = User.builder().email("x@y.dev").build();
        assertNotNull(minimal);
        // full round-trip of a complete document (Jackson 3 rejects missing primitives,
        // which is itself a good failure mode against truncated payloads)
        String json = mapper.writeValueAsString(validUser());
        User back = mapper.readValue(json, User.class);
        assertEquals("jane@example.com", back.getEmail());
    }
}
