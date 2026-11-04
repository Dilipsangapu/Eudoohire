package com.euodoo.hire.repository;

import com.euodoo.hire.model.CandidateResume;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for a candidate's stored resume versions.
 *
 * Every lookup is scoped by {@code candidateUserId}; callers must still verify
 * ownership before returning file bytes.
 */
@Repository
public interface CandidateResumeRepository extends MongoRepository<CandidateResume, String> {

    List<CandidateResume> findByCandidateUserIdOrderByVersionDesc(String candidateUserId);

    List<CandidateResume> findByCandidateUserIdAndActiveTrue(String candidateUserId);

    Optional<CandidateResume> findFirstByCandidateUserIdOrderByVersionDesc(String candidateUserId);

    List<CandidateResume> findByCandidateUserIdAndStoredPublicId(String candidateUserId,
                                                                 String storedPublicId);

    void deleteByCandidateUserId(String candidateUserId);
}
