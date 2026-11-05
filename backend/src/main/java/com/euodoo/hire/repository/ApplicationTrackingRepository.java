package com.euodoo.hire.repository;

import com.euodoo.hire.model.ApplicationTracking;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApplicationTrackingRepository extends MongoRepository<ApplicationTracking, String> {

    List<ApplicationTracking> findBySubmissionIdOrderByTimestampDesc(String submissionId);

    List<ApplicationTracking> findBySubmissionIdOrderByTimestampAsc(String submissionId);
}
