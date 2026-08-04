package com.square.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * One recorded privileged action: who did what, to whom/what, and when.
 *
 * An IT asset system has to be able to answer "who scrapped that laptop?" and
 * "who reset that password?" months later. Application logs rotate away and are
 * not queryable by the people who need the answer, so these are rows in the
 * database instead.
 *
 * Records are written, never updated or deleted — an audit trail that can be
 * edited is not an audit trail.
 */
@Entity
@Table(name = "audit_events", indexes = {
        @Index(name = "idx_audit_at", columnList = "at"),
        @Index(name = "idx_audit_actor", columnList = "actor_username"),
        @Index(name = "idx_audit_action", columnList = "action")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Who performed it — the signed-in username from the token, not the request body. */
    @Column(name = "actor_username", nullable = false)
    private String actorUsername;

    /** Their role at the time, so later role changes do not rewrite history. */
    @Column(name = "actor_role")
    private String actorRole;

    /** What happened, e.g. PASSWORD_RESET, ASSET_SCRAPPED, EMPLOYEE_ONBOARDED. */
    @Column(nullable = false)
    private String action;

    /** What it happened to, e.g. a username, serial number or department name. */
    @Column(name = "target")
    private String target;

    /** Human-readable detail shown in the audit view. */
    @Column(length = 500)
    private String detail;

    @Column(name = "at", nullable = false)
    private LocalDateTime at;
}
