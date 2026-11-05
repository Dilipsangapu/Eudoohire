package com.euodoo.hire.repository;

import com.euodoo.hire.model.AccountStatus;
import com.euodoo.hire.model.Role;
import com.euodoo.hire.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

/**
 * Repository for User documents.
 * The unique index on 'email' is declared on the @Document class.
 */
@Repository
public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findByRoleAndAccountStatus(Role role, AccountStatus status);

    List<User> findByRole(Role role);
}
