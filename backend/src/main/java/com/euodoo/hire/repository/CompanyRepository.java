package com.euodoo.hire.repository;

import com.euodoo.hire.model.ApprovalStatus;
import com.euodoo.hire.model.Company;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Company documents.
 */
@Repository
public interface CompanyRepository extends MongoRepository<Company, String> {

    List<Company> findByApprovalStatus(ApprovalStatus status);

    boolean existsByNameIgnoreCase(String name);

    List<Company> findByAuthorizedRecruiterIdsContaining(String userId);
}
