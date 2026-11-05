package com.euodoo.hire.exception;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.BusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;

public class AgencyExceptions {

    public static class AgencyAlreadyExistsException extends BusinessException {
        public AgencyAlreadyExistsException(String message) {
            super("AGENCY_ALREADY_EXISTS", message);
        }
    }

    public static class AgencyNotApprovedException extends BusinessException {
        public AgencyNotApprovedException(String message) {
            super("AGENCY_NOT_APPROVED", message);
        }
    }

    public static class DocumentVerificationException extends BusinessException {
        public DocumentVerificationException(String message) {
            super("DOCUMENT_VERIFICATION_ERROR", message);
        }
    }

    public static class CandidateNotFoundException extends ResourceNotFoundException {
        public CandidateNotFoundException(String id) {
            super("Candidate", id);
        }
    }

    public static class ClientCompanyNotFoundException extends ResourceNotFoundException {
        public ClientCompanyNotFoundException(String id) {
            super("ClientCompany", id);
        }
    }

    public static class JobNotFoundException extends ResourceNotFoundException {
        public JobNotFoundException(String id) {
            super("Job", id);
        }
    }

    public static class SubmissionNotFoundException extends ResourceNotFoundException {
        public SubmissionNotFoundException(String id) {
            super("CandidateSubmission", id);
        }
    }

    public static class InvalidSubmissionStatusException extends BusinessException {
        public InvalidSubmissionStatusException(String message) {
            super("INVALID_SUBMISSION_STATUS", message);
        }
    }

    public static class UnauthorizedAgencyAccessException extends AccessDeniedBusinessException {
        public UnauthorizedAgencyAccessException(String message) {
            super(message);
        }
    }

    public static class InvalidStatusTransitionException extends BusinessException {
        public InvalidStatusTransitionException(String message) {
            super("INVALID_STATUS_TRANSITION", message);
        }
    }
}
