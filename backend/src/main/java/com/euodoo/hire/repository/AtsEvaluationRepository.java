package com.euodoo.hire.repository;

import com.euodoo.hire.model.AtsEvaluation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for completed ATS evaluations.
 * All retrieval methods are scoped and sorted — never full collection scans:
 *  - candidate history: (candidateUserId, kind) newest first
 *  - recruiter results: (recruiterUserId [, candidateUserId [, jobId]])
 *  - idempotency replay: (candidateUserId, idempotencyKey)
 */
@Repository
public interface AtsEvaluationRepository extends MongoRepository<AtsEvaluation, String> {

    Optional<AtsEvaluation> findByCandidateUserIdAndIdempotencyKey(
            String candidateUserId, String idempotencyKey);

    Page<AtsEvaluation> findByCandidateUserIdAndKindOrderByCreatedAtDesc(
            String candidateUserId, String kind, Pageable pageable);

    Page<AtsEvaluation> findByRecruiterUserIdOrderByCreatedAtDesc(
            String recruiterUserId, Pageable pageable);

    Page<AtsEvaluation> findByRecruiterUserIdAndCandidateUserIdOrderByCreatedAtDesc(
            String recruiterUserId, String candidateUserId, Pageable pageable);

    Page<AtsEvaluation> findByRecruiterUserIdAndCandidateUserIdAndJobIdOrderByCreatedAtDesc(
            String recruiterUserId, String candidateUserId, String jobId, Pageable pageable);

    /** Resume Management: newest candidate-self evaluation for one stored resume version. */
    Page<AtsEvaluation> findByCandidateUserIdAndResumeIdAndKindOrderByCreatedAtDesc(
            String candidateUserId, String resumeId, String kind, Pageable pageable);

    /** Legacy linkage: evaluations recorded against a stored storage public id. */
    List<AtsEvaluation> findByCandidateUserIdAndResumeRef(String candidateUserId, String resumeRef);
}
