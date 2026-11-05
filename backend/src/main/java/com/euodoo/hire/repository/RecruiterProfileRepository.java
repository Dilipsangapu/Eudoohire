package com.euodoo.hire.repository;

import com.euodoo.hire.model.ApprovalStatus;
import com.euodoo.hire.model.RecruiterProfile;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for RecruiterProfile documents.
 */
@Repository
public interface RecruiterProfileRepository extends MongoRepository<RecruiterProfile, String> {

    Optional<RecruiterProfile> findByUserId(String userId);

    boolean existsByUserId(String userId);

    List<RecruiterProfile> findByCompanyId(String companyId);

    List<RecruiterProfile> findByUserIdIn(java.util.Collection<String> userIds);

    List<RecruiterProfile> findByApprovalStatus(ApprovalStatus status);

    List<RecruiterProfile> findByCompanyIdAndApprovalStatus(String companyId, ApprovalStatus status);
}
