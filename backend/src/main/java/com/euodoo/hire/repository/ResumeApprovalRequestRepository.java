package com.euodoo.hire.repository;

import com.euodoo.hire.model.ChangeRequestStatus;
import com.euodoo.hire.model.ResumeApprovalRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for ResumeApprovalRequest documents.
 */
@Repository
public interface ResumeApprovalRequestRepository extends MongoRepository<ResumeApprovalRequest, String> {

    List<ResumeApprovalRequest> findByCandidateUserId(String candidateUserId);

    List<ResumeApprovalRequest> findAllByOrderByCreatedAtDesc();

    Page<ResumeApprovalRequest> findByStatus(ChangeRequestStatus status, Pageable pageable);

    Optional<ResumeApprovalRequest> findTopByCandidateUserIdOrderByCreatedAtDesc(String candidateUserId);

    boolean existsByCandidateUserIdAndStatus(String candidateUserId, ChangeRequestStatus status);
}
