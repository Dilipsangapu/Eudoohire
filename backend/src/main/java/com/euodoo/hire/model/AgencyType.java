package com.euodoo.hire.model;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum AgencyType {
    RECRUITMENT_AGENCY,
    STAFFING_AGENCY,
    PLACEMENT_CONSULTANCY,
    OTHER;

    @JsonCreator
    public static AgencyType fromString(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase();
        if ("OTHERS".equals(normalized)) {
            return OTHER;
        }
        for (AgencyType type : values()) {
            if (type.name().equalsIgnoreCase(normalized)) {
                return type;
            }
        }
        return OTHER;
    }
}
