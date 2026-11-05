package com.euodoo.hire.repository;

import com.euodoo.hire.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository for AuditLog documents.
 * Audit logs are append-only — no update or delete methods are exposed.
 */
@Repository
public interface AuditLogRepository extends MongoRepository<AuditLog, String> {

    Page<AuditLog> findByActorUserId(String actorUserId, Pageable pageable);

    Page<AuditLog> findByTargetId(String targetId, Pageable pageable);

    Page<AuditLog> findByAction(String action, Pageable pageable);
}
