package com.euodoo.hire.repository;

import com.euodoo.hire.model.InterviewStatus;
import com.euodoo.hire.model.AgencyInterview;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgencyInterviewRepository extends MongoRepository<AgencyInterview, String> {

    List<AgencyInterview> findByAgencyId(String agencyId);

    Page<AgencyInterview> findByAgencyId(String agencyId, Pageable pageable);

    Optional<AgencyInterview> findByIdAndAgencyId(String id, String agencyId);

    List<AgencyInterview> findBySubmissionId(String submissionId);

    List<AgencyInterview> findByCandidateId(String candidateId);

    List<AgencyInterview> findByAgencyIdAndInterviewStatus(String agencyId, InterviewStatus interviewStatus);

    long countByAgencyIdAndInterviewStatus(String agencyId, InterviewStatus interviewStatus);
}
