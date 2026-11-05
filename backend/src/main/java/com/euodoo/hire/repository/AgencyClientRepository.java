package com.euodoo.hire.repository;

import com.euodoo.hire.model.AgencyClientStatus;
import com.euodoo.hire.model.AgencyClient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgencyClientRepository extends MongoRepository<AgencyClient, String> {

    List<AgencyClient> findByAgencyId(String agencyId);

    Page<AgencyClient> findByAgencyId(String agencyId, Pageable pageable);

    Optional<AgencyClient> findByIdAndAgencyId(String id, String agencyId);

    boolean existsByIdAndAgencyId(String id, String agencyId);

    long countByAgencyId(String agencyId);

    long countByAgencyIdAndStatus(String agencyId, AgencyClientStatus status);

    List<AgencyClient> findByAgencyIdAndStatus(String agencyId, AgencyClientStatus status);
}
