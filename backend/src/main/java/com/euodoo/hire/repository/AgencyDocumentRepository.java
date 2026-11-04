package com.euodoo.hire.repository;

import com.euodoo.hire.model.AgencyDocumentType;
import com.euodoo.hire.model.AgencyDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgencyDocumentRepository extends MongoRepository<AgencyDocument, String> {

    List<AgencyDocument> findByAgencyId(String agencyId);

    Optional<AgencyDocument> findByAgencyIdAndDocumentType(String agencyId, AgencyDocumentType documentType);

    Optional<AgencyDocument> findByIdAndAgencyId(String id, String agencyId);

    void deleteByAgencyId(String agencyId);
}
