package com.euodoo.hire.repository;

import com.euodoo.hire.model.ChangeRequestStatus;
import com.euodoo.hire.model.PortfolioChangeRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for PortfolioChangeRequest documents.
 */
@Repository
public interface PortfolioChangeRequestRepository extends MongoRepository<PortfolioChangeRequest, String> {

    List<PortfolioChangeRequest> findByCandidateUserId(String candidateUserId);

    List<PortfolioChangeRequest> findByCandidateUserIdOrderByCreatedAtDesc(String candidateUserId);

    Optional<PortfolioChangeRequest> findTopByCandidateUserIdAndStatusOrderByCreatedAtDesc(
            String candidateUserId, ChangeRequestStatus status);

    Page<PortfolioChangeRequest> findByStatus(ChangeRequestStatus status, Pageable pageable);

    boolean existsByCandidateUserIdAndStatus(String candidateUserId, ChangeRequestStatus status);
}
