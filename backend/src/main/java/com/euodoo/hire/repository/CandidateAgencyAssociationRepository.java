package com.euodoo.hire.repository;

import com.euodoo.hire.model.CandidateAssociationStatus;
import com.euodoo.hire.model.CandidateAgencyAssociation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CandidateAgencyAssociationRepository extends MongoRepository<CandidateAgencyAssociation, String> {

    List<CandidateAgencyAssociation> findByAgencyId(String agencyId);

    Page<CandidateAgencyAssociation> findByAgencyId(String agencyId, Pageable pageable);

    Optional<CandidateAgencyAssociation> findByAgencyIdAndCandidateId(String agencyId, String candidateId);

    boolean existsByAgencyIdAndCandidateId(String agencyId, String candidateId);

    long countByAgencyId(String agencyId);

    long countByAgencyIdAndStatus(String agencyId, CandidateAssociationStatus status);
}
