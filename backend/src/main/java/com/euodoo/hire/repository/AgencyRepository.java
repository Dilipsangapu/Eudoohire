package com.euodoo.hire.repository;

import com.euodoo.hire.model.AgencyRegistrationStatus;
import com.euodoo.hire.model.Agency;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgencyRepository extends MongoRepository<Agency, String> {

    Optional<Agency> findByOfficialEmailIgnoreCase(String officialEmail);

    boolean existsByOfficialEmailIgnoreCase(String officialEmail);

    boolean existsByBusinessRegistrationNumber(String businessRegistrationNumber);

    Optional<Agency> findByRegisteredUserId(String registeredUserId);

    Page<Agency> findByRegistrationStatus(AgencyRegistrationStatus status, Pageable pageable);

    List<Agency> findByRegistrationStatus(AgencyRegistrationStatus status);
}
