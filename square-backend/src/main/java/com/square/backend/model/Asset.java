package com.square.backend.model; // Added .backend here

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "assets", indexes = {
    @Index(name = "idx_asset_serial", columnList = "serialNumber"),
    @Index(name = "idx_asset_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Asset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String serialNumber;

    @Column(nullable = false)
    private String deviceType;

    // Employee self-registration details
    private String deviceKind;      // Mobile / Laptop / Desktop / Printer / Other
    private String prNumber;        // Purchase Requisition number
    private String assetCategory;   // ASSET / NON_ASSET
    private String assetNumber;     // only when assetCategory == ASSET
    private String supplierName;
    private String department;
    private String ipAddress;   // captured by the Superuser's onboarding form

    // Where IT stores the device after receiving it back (IT Closet / Basement / Sector 3)
    private String storageLocation;

    @Column(columnDefinition = "TEXT")
    private String specifications;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssetStatus status;

    private LocalDate purchaseDate;
    private LocalDate warrantyExpiry;
    private String invoiceUrl;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "location_id")
    private Long locationId;


    private double originalValue;
    private int usefulLifeYears;


    @Enumerated(EnumType.STRING)
    private AssetCondition poolCondition;

    // Live Loaner Ledger
    private boolean isLoaner;
    private LocalDate loanerIssuedAt;

    // Repair log — set while status == IN_REPAIR; userId keeps pointing at the owner
    private String repairShop;         // "Original shop (warranty)" or "Trusted repair shop"
    private LocalDate sentToRepairAt;

    // New-device issue awaiting supervisor acceptance — set while status == UNDER_REVIEW
    @Column(name = "pending_user_id")
    private Long pendingUserId;

    // Scrap Registry
    private String scrapReason;
    private LocalDate scrappedAt;
}



        