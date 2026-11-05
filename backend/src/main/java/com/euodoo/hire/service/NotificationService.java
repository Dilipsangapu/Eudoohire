package com.euodoo.hire.service;

import com.euodoo.hire.exception.AccessDeniedBusinessException;
import com.euodoo.hire.exception.ResourceNotFoundException;
import com.euodoo.hire.model.Notification;
import com.euodoo.hire.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;

    /**
     * Sends a rich notification with title and optional actionUrl.
     */
    @Async
    public void notify(String recipientUserId, String title, String message,
                       String type, String relatedRecordId, String relatedRecordType, String actionUrl) {
        if (recipientUserId == null || recipientUserId.isBlank()) {
            return;
        }
        try {
            Notification notification = Notification.builder()
                    .recipientUserId(recipientUserId)
                    .title(title != null ? title : cleanTitleFromType(type))
                    .message(message)
                    .type(type)
                    .relatedRecordId(relatedRecordId)
                    .relatedRecordType(relatedRecordType)
                    .actionUrl(actionUrl)
                    .read(false)
                    .createdAt(Instant.now())
                    .build();
            notificationRepository.save(notification);
            log.info("Notification sent to userId={} type='{}' title='{}'", recipientUserId, type, title);
        } catch (Exception e) {
            log.error("Failed to send notification [type={}, recipient={}]: {}",
                    type, recipientUserId, e.getMessage());
        }
    }

    /**
     * Sends a notification to the specified recipient asynchronously (backward compatible).
     */
    @Async
    public void notify(String recipientUserId, String type, String message,
                       String relatedRecordId, String relatedRecordType) {
        notify(recipientUserId, cleanTitleFromType(type), message, type, relatedRecordId, relatedRecordType, null);
    }

    public Page<Notification> getNotifications(String requestingUserId, boolean unreadOnly, Pageable pageable) {
        if (unreadOnly) {
            return notificationRepository.findByRecipientUserIdAndRead(requestingUserId, false, pageable);
        }
        return notificationRepository.findByRecipientUserId(requestingUserId, pageable);
    }

    public long countUnread(String requestingUserId) {
        return notificationRepository.countByRecipientUserIdAndRead(requestingUserId, false);
    }

    public Notification markAsRead(String notificationId, String requestingUserId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", notificationId));
        if (!notification.getRecipientUserId().equals(requestingUserId)) {
            throw new AccessDeniedBusinessException("You cannot mark another user's notification as read.");
        }
        notification.setRead(true);
        return notificationRepository.save(notification);
    }

    public int markAllAsRead(String requestingUserId) {
        List<Notification> unread = notificationRepository.findByRecipientUserIdAndRead(requestingUserId, false);
        if (unread.isEmpty()) {
            return 0;
        }
        for (Notification n : unread) {
            n.setRead(true);
        }
        notificationRepository.saveAll(unread);
        return unread.size();
    }

    public void deleteNotification(String notificationId, String requestingUserId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", notificationId));
        if (!notification.getRecipientUserId().equals(requestingUserId)) {
            throw new AccessDeniedBusinessException("You cannot delete another user's notification.");
        }
        notificationRepository.delete(notification);
    }

    private String cleanTitleFromType(String type) {
        if (type == null || type.isBlank()) return "Notification";
        String[] words = type.replace('_', ' ').toLowerCase().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) {
                sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1)).append(" ");
            }
        }
        return sb.toString().trim();
    }
}
