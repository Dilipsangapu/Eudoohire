package com.euodoo.hire.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "application_tracking")
@CompoundIndexes({
    @CompoundIndex(name = "submission_timestamp_idx", def = "{'submissionId': 1, 'timestamp': -1}")
})
public class ApplicationTracking {

    @Id
    private String id;

    @Indexed
    private String submissionId;

    private String previousStatus;

    private String currentStatus;

    private String updatedByUserId;

    private String updatedByRole;

    private String comments;

    @CreatedDate
    @Indexed
    private Instant timestamp;
}
