package com.euodoo.hire.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;

/**
 * MongoDB Transaction Configuration.
 *
 * Configures MongoTransactionManager for multi-document ACID transactions.
 * Transactions require a MongoDB Replica Set (or sharded cluster).
 * Enabled by setting spring.data.mongodb.transaction.enabled=true in production/replica-set deployments.
 * Disabled by default on standalone MongoDB instances to prevent error 263 (OperationNotSupportedInTransaction).
 */
@Configuration
public class MongoConfig {

    @Bean
    @ConditionalOnProperty(name = "spring.data.mongodb.transaction.enabled", havingValue = "true", matchIfMissing = false)
    public MongoTransactionManager transactionManager(MongoDatabaseFactory dbFactory) {
        return new MongoTransactionManager(dbFactory);
    }

    /**
     * Explicitly ensure unique, sparse indexes on gatewayOrderId and gatewayPaymentId
     * for both payments and subscriptions collections to enforce idempotency and prevent duplicates.
     */
    @Bean
    public org.springframework.boot.CommandLineRunner ensurePaymentAndSubscriptionIndexes(
            org.springframework.data.mongodb.core.MongoTemplate mongoTemplate) {
        return args -> {
            try {
                mongoTemplate.indexOps(com.euodoo.hire.model.Payment.class).ensureIndex(
                        new org.springframework.data.mongodb.core.index.Index().on("gatewayOrderId", org.springframework.data.domain.Sort.Direction.ASC).unique().sparse());
                mongoTemplate.indexOps(com.euodoo.hire.model.Payment.class).ensureIndex(
                        new org.springframework.data.mongodb.core.index.Index().on("gatewayPaymentId", org.springframework.data.domain.Sort.Direction.ASC).unique().sparse());

                mongoTemplate.indexOps(com.euodoo.hire.model.Subscription.class).ensureIndex(
                        new org.springframework.data.mongodb.core.index.Index().on("gatewayOrderId", org.springframework.data.domain.Sort.Direction.ASC).unique().sparse());
                mongoTemplate.indexOps(com.euodoo.hire.model.Subscription.class).ensureIndex(
                        new org.springframework.data.mongodb.core.index.Index().on("gatewayPaymentId", org.springframework.data.domain.Sort.Direction.ASC).unique().sparse());
            } catch (Exception e) {
                org.slf4j.LoggerFactory.getLogger(MongoConfig.class).warn("Ensure indexes warning: {}", e.getMessage());
            }
        };
    }
}
