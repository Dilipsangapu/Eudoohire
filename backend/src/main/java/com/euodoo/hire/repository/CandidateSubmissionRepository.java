package com.euodoo.hire.repository;

import com.euodoo.hire.model.SubmissionStatus;
import com.euodoo.hire.model.CandidateSubmission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CandidateSubmissionRepository extends MongoRepository<CandidateSubmission, String> {

    List<CandidateSubmission> findByAgencyId(String agencyId);

    Page<CandidateSubmission> findByAgencyId(String agencyId, Pageable pageable);

    Optional<CandidateSubmission> findByIdAndAgencyId(String id, String agencyId);

    List<CandidateSubmission> findByAgencyIdAndJobId(String agencyId, String jobId);

    List<CandidateSubmission> findByAgencyIdAndJobIdAndCandidateId(String agencyId, String jobId, String candidateId);

    boolean existsByAgencyIdAndJobIdAndCandidateIdAndAdminReviewStatusNotIn(
            String agencyId, String jobId, String candidateId, java.util.Collection<SubmissionStatus> inactiveStatuses);

    Page<CandidateSubmission> findByAdminReviewStatus(SubmissionStatus adminReviewStatus, Pageable pageable);

    List<CandidateSubmission> findByAdminReviewStatus(SubmissionStatus adminReviewStatus);

    Page<CandidateSubmission> findByRecruiterUserId(String recruiterUserId, Pageable pageable);

    List<CandidateSubmission> findByRecruiterUserId(String recruiterUserId);

    long countByAgencyId(String agencyId);

    long countByAgencyIdAndAdminReviewStatus(String agencyId, SubmissionStatus adminReviewStatus);

    long countByAgencyIdAndJobId(String agencyId, String jobId);
}
