package com.euodoo.hire.exception;

import com.euodoo.hire.exception.ResourceNotFoundException;

public class AgencyNotFoundException extends ResourceNotFoundException {
    public AgencyNotFoundException(String id) {
        super("Agency", id);
    }
}
