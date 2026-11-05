package com.euodoo.hire.repository;

import com.euodoo.hire.model.AtsUsage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for per-candidate ATS usage counters. Registration here also
 * ensures the unique index on candidateUserId is created at startup.
 * Enforcement itself uses atomic conditional findAndModify on MongoTemplate
 * (see AtsService) — the counter is never incremented non-atomically.
 */
@Repository
public interface AtsUsageRepository extends MongoRepository<AtsUsage, String> {

    Optional<AtsUsage> findByCandidateUserId(String candidateUserId);
}
