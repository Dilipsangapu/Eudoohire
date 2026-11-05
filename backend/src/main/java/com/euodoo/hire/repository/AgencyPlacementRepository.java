package com.euodoo.hire.repository;

import com.euodoo.hire.model.PlacementStatus;
import com.euodoo.hire.model.AgencyPlacement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgencyPlacementRepository extends MongoRepository<AgencyPlacement, String> {

    List<AgencyPlacement> findByAgencyId(String agencyId);

    Page<AgencyPlacement> findByAgencyId(String agencyId, Pageable pageable);

    Optional<AgencyPlacement> findByIdAndAgencyId(String id, String agencyId);

    List<AgencyPlacement> findByJobId(String jobId);

    List<AgencyPlacement> findByClientCompanyId(String clientCompanyId);

    Optional<AgencyPlacement> findBySubmissionId(String submissionId);

    long countByAgencyId(String agencyId);

    long countByAgencyIdAndPlacementStatus(String agencyId, PlacementStatus status);
}
