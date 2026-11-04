package com.euodoo.hire.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Notification sent to platform users.
 *
 * Indexed by recipient and read status for efficient inbox queries.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "notifications")
@CompoundIndexes({
    @CompoundIndex(name = "recipient_read_idx", def = "{'recipientUserId': 1, 'read': 1, 'createdAt': -1}")
})
public class Notification {

    @Id
    private String id;

    @Indexed
    private String recipientUserId;

    private String title;
    private String type;
    private String message;

    /** ID and collection name of the related business record. */
    private String relatedRecordId;
    private String relatedRecordType;

    /** Optional destination route or link */
    private String actionUrl;

    @Builder.Default
    private boolean read = false;

    @CreatedDate
    @Builder.Default
    private Instant createdAt = Instant.now();
}
