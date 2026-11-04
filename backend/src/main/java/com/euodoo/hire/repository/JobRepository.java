package com.euodoo.hire.repository;

import com.euodoo.hire.model.Job;
import com.euodoo.hire.model.JobStatus;
import com.euodoo.hire.model.WorkMode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Job documents.
 * Supports pagination, filtering and text search for job listings.
 */
@Repository
public interface JobRepository extends MongoRepository<Job, String> {

    Page<Job> findByStatus(JobStatus status, Pageable pageable);

    Page<Job> findByCompanyIdAndStatus(String companyId, JobStatus status, Pageable pageable);

    List<Job> findByCompanyIdAndRecruiterUserId(String companyId, String recruiterUserId);

    Page<Job> findByStatusAndLocation(JobStatus status, String location, Pageable pageable);

    Page<Job> findByStatusAndWorkMode(JobStatus status, WorkMode workMode, Pageable pageable);

    Page<Job> findByStatusAndLocationAndWorkMode(
            JobStatus status, String location, WorkMode workMode, Pageable pageable);

    @Query("{ 'status': ?0, 'techStack': { $in: ?1 } }")
    Page<Job> findByStatusAndTechStackIn(JobStatus status, List<String> techStack, Pageable pageable);

    @Query("{ 'status': ?0, $or: [ { 'title': { $regex: ?1, $options: 'i' } }, { 'description': { $regex: ?1, $options: 'i' } } ] }")
    Page<Job> searchByKeyword(JobStatus status, String keyword, Pageable pageable);

    boolean existsByIdAndRecruiterUserId(String id, String recruiterUserId);

    List<Job> findByRecruiterUserId(String recruiterUserId);

    List<Job> findByRecruiterUserIdOrderByCreatedAtDesc(String recruiterUserId);

    /** Admin: all jobs for any of the given company IDs (tenant-scoped). */
    List<Job> findByCompanyIdIn(List<String> companyIds);

    /** Filter by status list — used for candidate-eligible job queries. */
    @Query("{ 'status': { $in: ?0 } }")
    Page<Job> findByStatusIn(List<JobStatus> statuses, Pageable pageable);

    // ─── Agency job queries ────────────────────────────
    List<Job> findByAgencyId(String agencyId);

    Page<Job> findByAgencyId(String agencyId, Pageable pageable);

    Page<Job> findByAgencyIdAndClientCompanyId(String agencyId, String clientCompanyId, Pageable pageable);

    java.util.Optional<Job> findByIdAndAgencyId(String id, String agencyId);

    Page<Job> findByAgencyIdAndStatus(String agencyId, JobStatus status, Pageable pageable);

    long countByAgencyId(String agencyId);

    long countByAgencyIdAndStatus(String agencyId, JobStatus status);
}
