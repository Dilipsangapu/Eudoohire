package com.euodoo.hire.repository;

import com.euodoo.hire.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository for Notification documents.
 */
@Repository
public interface NotificationRepository extends MongoRepository<Notification, String> {

    Page<Notification> findByRecipientUserId(String recipientUserId, Pageable pageable);

    Page<Notification> findByRecipientUserIdAndRead(
            String recipientUserId, boolean read, Pageable pageable);

    java.util.List<Notification> findByRecipientUserIdAndRead(String recipientUserId, boolean read);

    long countByRecipientUserIdAndRead(String recipientUserId, boolean read);

    void deleteByRecipientUserId(String recipientUserId);
}
