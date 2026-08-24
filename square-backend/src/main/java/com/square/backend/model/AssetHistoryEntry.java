package com.square.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Append-only log for an {@link Asset} — state-change events and plain
 * usage/portion log entries live side by side here, newest first, so a
 * product's whole life can be read from one trail. Covers both serialized
 * devices and bulk stock rows.
 */
@Entity
@Table(name = "asset_history", indexes = {
    @Index(name = "idx_asset_history_item", columnList = "asset_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssetHistoryEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "asset_id", nullable = false)
    private Long assetId;

    @Column(nullable = false)
    private String action;

    private String reason;
    private Integer quantityMoved;
    private String amountUsed;
    private Integer daysUsed;

    @Column(name = "used_by_user_id")
    private Long usedByUserId;
    private String usedByName;

    @Column(nullable = false)
    private String actorUsername;

    @Column(nullable = false)
    private LocalDateTime at;
}
