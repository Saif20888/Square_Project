package com.square.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Tenant scaffold for a future SaaS split — unused by app logic today.
 * Every org-scoped table (users, assets, tickets) carries a nullable
 * organization_id pointing here so a real multi-tenant cutover is a
 * backfill + enforce, not a schema redesign.
 */
@Entity
@Table(name = "organizations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
