package com.euodoo.hire.repository;

import com.euodoo.hire.model.RecruiterActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Repository for recruiter engagement activity documents.
 * Queries are scoped by candidate/recruiter ID and sorted by timestamp
 * (newest first) rather than scanning the whole collection.
 */
@Repository
public interface RecruiterActivityRepository extends MongoRepository<RecruiterActivity, String> {

    Page<RecruiterActivity> findByCandidateUserIdOrderByTimestampDesc(
            String candidateUserId, Pageable pageable);

    Page<RecruiterActivity> findByCandidateUserIdAndRecruiterUserIdIsNotNullOrderByTimestampDesc(
            String candidateUserId, Pageable pageable);

    Page<RecruiterActivity> findByRecruiterUserIdOrderByTimestampDesc(
            String recruiterUserId, Pageable pageable);

    Optional<RecruiterActivity> findFirstByRecruiterUserIdAndCandidateUserIdAndEventTypeOrderByTimestampDesc(
            String recruiterUserId, String candidateUserId, String eventType);

    long countByCandidateUserIdAndRecruiterUserIdIsNotNull(String candidateUserId);

    long countByCandidateUserIdAndRecruiterUserIdIsNotNullAndTimestampAfter(
            String candidateUserId, Instant after);

    long countByCandidateUserIdAndEventType(String candidateUserId, String eventType);

    List<RecruiterActivity> findByCandidateUserIdAndRecruiterUserIdIsNotNullAndTimestampAfter(
            String candidateUserId, Instant after);
}
