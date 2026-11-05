package com.euodoo.hire.service;

import com.euodoo.hire.model.AuditLog;
import com.euodoo.hire.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Records an audit event asynchronously.
     *
     * @param actorUserId ID of the user performing the action
     * @param actorRole   Role of the actor
     * @param targetType  Type of the target record
     * @param targetId    ID of the target record
     * @param action      Action name (e.g., "CANDIDATE_APPROVED")
     * @param metadata    Safe metadata (no secrets or sensitive PII)
     */
    @Async
    public void log(String actorUserId, String actorRole, String targetType,
                    String targetId, String action, Map<String, String> metadata) {
        try {
            AuditLog entry = AuditLog.builder()
                    .actorUserId(actorUserId)
                    .actorRole(actorRole)
                    .targetType(targetType)
                    .targetId(targetId)
                    .action(action)
                    .timestamp(Instant.now())
                    .metadata(metadata)
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            // Never let audit logging failures break business operations
            log.error("Failed to write audit log [action={}]: {}", action, e.getMessage());
        }
    }
}
