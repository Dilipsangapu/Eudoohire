package com.euodoo.hire.repository;

import com.euodoo.hire.model.CandidateCertification;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for a candidate's professional certifications. All listings are
 * scoped by {@code candidateUserId}; callers must still verify ownership
 * before mutating or returning file bytes.
 */
@Repository
public interface CandidateCertificationRepository extends MongoRepository<CandidateCertification, String> {

    List<CandidateCertification> findByCandidateUserIdOrderByCreatedAtDesc(String candidateUserId);

    List<CandidateCertification> findByCandidateUserIdAndTitleIgnoreCaseAndIssuerIgnoreCase(
            String candidateUserId, String title, String issuer);

    Optional<CandidateCertification> findFirstByIdAndCandidateUserId(String id, String candidateUserId);

    void deleteByCandidateUserId(String candidateUserId);
}
