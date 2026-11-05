package com.euodoo.hire.repository;

import com.euodoo.hire.model.ShortlistStatus;
import com.euodoo.hire.model.CandidateShortlist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CandidateShortlistRepository extends MongoRepository<CandidateShortlist, String> {

    List<CandidateShortlist> findByAgencyIdAndShortlistStatus(String agencyId, ShortlistStatus status);

    Page<CandidateShortlist> findByAgencyIdAndShortlistStatus(String agencyId, ShortlistStatus status, Pageable pageable);

    List<CandidateShortlist> findByAgencyIdAndJobIdAndShortlistStatus(String agencyId, String jobId, ShortlistStatus status);

    Optional<CandidateShortlist> findByAgencyIdAndJobIdAndCandidateId(String agencyId, String jobId, String candidateId);

    Optional<CandidateShortlist> findByIdAndAgencyId(String id, String agencyId);

    long countByAgencyIdAndShortlistStatus(String agencyId, ShortlistStatus status);

    long countByAgencyIdAndJobIdAndShortlistStatus(String agencyId, String jobId, ShortlistStatus status);
}
