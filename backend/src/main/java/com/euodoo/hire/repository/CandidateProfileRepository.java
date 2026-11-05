package com.euodoo.hire.repository;

import com.euodoo.hire.model.ApprovalStatus;
import com.euodoo.hire.model.CandidateProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for CandidateProfile documents.
 */
@Repository
public interface CandidateProfileRepository extends MongoRepository<CandidateProfile, String> {

    Optional<CandidateProfile> findByUserId(String userId);

    boolean existsByUserId(String userId);

    /**
     * Find approved, visible candidate profiles for recruiter search.
     * PREMIUM candidates are prioritized via a separate query layer in the service.
     */
    Page<CandidateProfile> findByProfileApprovalStatusAndVisibleToRecruiters(
            ApprovalStatus status, boolean visible, Pageable pageable);

    /**
     * Skill-based search for approved visible candidates.
     */
    @Query("{ 'profileApprovalStatus': ?0, 'visibleToRecruiters': ?1, 'skills': { $in: ?2 } }")
    Page<CandidateProfile> findByApprovalStatusAndVisibleAndSkillsIn(
            ApprovalStatus status, boolean visible, java.util.List<String> skills, Pageable pageable);

    Page<CandidateProfile> findByProfileApprovalStatus(ApprovalStatus status, Pageable pageable);
}
