package com.euodoo.hire.repository;

import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.Subscription;
import com.euodoo.hire.model.SubscriptionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Subscription documents.
 *
 * <p>Subscriptions are looked up by userId to enforce access guards on
 * candidate-search and profile endpoints.
 */
@Repository
public interface SubscriptionRepository extends MongoRepository<Subscription, String> {

    /** Find the most recent active subscription for a user. */
    Optional<Subscription> findFirstByUserIdAndStatusOrderByCreatedAtDesc(
            String userId, SubscriptionStatus status);

    /** All subscriptions for a user, newest first. */
    List<Subscription> findByUserIdOrderByCreatedAtDesc(String userId);

    /** Find a pending subscription by its gateway order id. */
    Optional<Subscription> findByGatewayOrderId(String gatewayOrderId);

    /** Find a subscription by its gateway payment id. */
    Optional<Subscription> findByGatewayPaymentId(String gatewayPaymentId);

    /** Check for existing active subscription. */
    boolean existsByUserIdAndStatus(String userId, SubscriptionStatus status);

    /** Admin: paginated view of all subscriptions. */
    Page<Subscription> findByUserRole(Role role, Pageable pageable);

    /** Admin: all subscriptions, newest first. */
    Page<Subscription> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Find all subscriptions with a given status. */
    List<Subscription> findByStatus(SubscriptionStatus status);
}
