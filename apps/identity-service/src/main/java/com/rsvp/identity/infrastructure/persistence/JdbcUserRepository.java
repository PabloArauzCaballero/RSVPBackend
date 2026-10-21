package com.rsvp.identity.infrastructure.persistence;

import com.rsvp.identity.domain.EmailAddress;
import com.rsvp.identity.domain.OrganizationMember;
import com.rsvp.identity.domain.Role;
import com.rsvp.identity.domain.User;
import com.rsvp.identity.domain.port.outbound.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;

public final class JdbcUserRepository implements UserRepository {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;

    public JdbcUserRepository(JdbcClient jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    @Override
    public void create(User user, String passwordHash) {
        try {
            transactions.executeWithoutResult(status -> {
                jdbc.sql("INSERT INTO identity_user (id, email, password_hash) VALUES (:id, :email, :hash)")
                    .param("id", user.id()).param("email", user.email().value()).param("hash", passwordHash).update();
                for (var role : user.roles()) {
                    jdbc.sql("INSERT INTO identity_user_role (user_id, role) VALUES (:id, :role)")
                        .param("id", user.id()).param("role", role.name()).update();
                }
            });
        } catch (DuplicateKeyException duplicate) { throw new DuplicateEmailException(); }
    }

    @Override
    public Optional<StoredUser> findByEmail(EmailAddress email) {
        return jdbc.sql("SELECT id, password_hash FROM identity_user WHERE email = :email")
            .param("email", email.value())
            .query((row, number) -> new Object[] { row.getObject("id", UUID.class), row.getString("password_hash") })
            .optional()
            .map(found -> new StoredUser(new User((UUID) found[0], email, rolesOf((UUID) found[0])), (String) found[1]));
    }

    @Override
    public Optional<User> findById(UUID id) {
        return jdbc.sql("SELECT email FROM identity_user WHERE id = :id")
            .param("id", id)
            .query(String.class)
            .optional()
            .map(email -> new User(id, new EmailAddress(email), rolesOf(id)));
    }

    @Override
    public List<OrganizationMember> membershipsOf(UUID userId) {
        return jdbc.sql("SELECT organization_id, role FROM organization_member WHERE user_id = :id ORDER BY organization_id")
            .param("id", userId)
            .query((row, number) -> new OrganizationMember(row.getObject("organization_id", UUID.class), userId, Role.valueOf(row.getString("role"))))
            .list();
    }

    private java.util.Set<Role> rolesOf(UUID userId) {
        var roles = new HashSet<Role>();
        jdbc.sql("SELECT role FROM identity_user_role WHERE user_id = :id").param("id", userId).query(String.class).list()
            .forEach(role -> roles.add(Role.valueOf(role)));
        // Accounts created before platform roles existed are hosts.
        if (roles.isEmpty()) roles.add(Role.HOST);
        return roles;
    }
}
