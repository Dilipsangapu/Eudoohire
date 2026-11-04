package com.euodoo.hire.repository;

import com.euodoo.hire.model.ApprovalStatus;
import com.euodoo.hire.model.HiringRequest;
import com.euodoo.hire.model.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for HiringRequest documents.
 */
@Repository
public interface HiringRequestRepository extends MongoRepository<HiringRequest, String> {

    Optional<HiringRequest> findByCandidateUserIdAndJobId(String candidateUserId, String jobId);

    List<HiringRequest> findByRecruiterUserId(String recruiterUserId);

    List<HiringRequest> findByCandidateUserId(String candidateUserId);

    Page<HiringRequest> findByApprovalStatus(ApprovalStatus status, Pageable pageable);

    Page<HiringRequest> findByPaymentStatus(PaymentStatus status, Pageable pageable);

    List<HiringRequest> findByRecruiterUserIdAndPaymentStatus(
            String recruiterUserId, PaymentStatus paymentStatus);

    boolean existsByJobApplicationId(String jobApplicationId);

    /** Most recent released hire between a candidate and a recruiter, if any. */
    Optional<HiringRequest> findFirstByCandidateUserIdAndRecruiterUserIdAndCandidateReleasedTrueOrderByIdDesc(
            String candidateUserId, String recruiterUserId);
}
