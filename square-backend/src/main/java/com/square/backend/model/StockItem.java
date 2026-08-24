package com.square.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

/**
 * General IT-held stock — bulk items (asset and non-asset) tracked by quantity
 * rather than one row per physical unit like {@link Asset}. Moves one-way
 * through usable -> not usable -> scrap; a partial quantity can split off into
 * its own row so the rest stays behind in its current state.
 */
@Entity
@Table(name = "stock_items", indexes = {
    @Index(name = "idx_stock_state", columnList = "state")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StockCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StockCondition condition;

    @Column(nullable = false)
    private int quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StockState state;

    @Column(nullable = false)
    private String storageLocation;

    @Column(nullable = false)
    private LocalDate registeredAt;

    private String notUsableReason;
    private LocalDate movedToNotUsableAt;

    private String scrapReason;
    private LocalDate scrappedAt;
}
