package com.euodoo.hire.repository;

import com.euodoo.hire.model.ApplicationStatus;
import com.euodoo.hire.model.JobApplication;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for JobApplication documents.
 * Compound unique index on (candidateUserId, jobId) prevents duplicates.
 */
@Repository
public interface JobApplicationRepository extends MongoRepository<JobApplication, String> {

    Optional<JobApplication> findByCandidateUserIdAndJobId(String candidateUserId, String jobId);

    boolean existsByCandidateUserIdAndJobId(String candidateUserId, String jobId);

    Page<JobApplication> findByCandidateUserId(String candidateUserId, Pageable pageable);

    Page<JobApplication> findByCandidateUserIdAndStatus(
            String candidateUserId, ApplicationStatus status, Pageable pageable);

    Page<JobApplication> findByJobId(String jobId, Pageable pageable);

    List<JobApplication> findByJobId(String jobId);

    Page<JobApplication> findByJobIdAndStatus(String jobId, ApplicationStatus status, Pageable pageable);

    List<JobApplication> findByCandidateUserIdAndStatusIn(
            String candidateUserId, List<ApplicationStatus> statuses);

    /** Paged shortlist records (statuses SHORTLISTED and later), newest first. */
    Page<JobApplication> findByCandidateUserIdAndStatusIn(
            String candidateUserId, List<ApplicationStatus> statuses, Pageable pageable);

    long countByCandidateUserIdAndStatus(String candidateUserId, ApplicationStatus status);

    List<JobApplication> findByRecruiterUserId(String recruiterUserId);

    Page<JobApplication> findByRecruiterUserId(String recruiterUserId, Pageable pageable);

    Optional<JobApplication> findFirstByRecruiterUserIdAndCandidateUserId(
            String recruiterUserId, String candidateUserId);

    long countByJobId(String jobId);

    long countByJobIdAndStatus(String jobId, ApplicationStatus status);
}
