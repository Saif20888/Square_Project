package com.square.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A message from the system (or a supervisor action) to the IT Team.
 *
 * DEVICE_RELEASE  — supervisor offboarded an employee and released their device
 *                   to IT immediately; IT should receive & store it.
 * DESK_COLLECTION — an offboarded employee's device was left at the desk on a
 *                   14-day hold; due 14 days later, IT should collect & store it.
 */
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String type;            // DEVICE_RELEASE | DESK_COLLECTION

    @Column(nullable = false)
    private String message;

    private Long assetId;
    private String employeeUsername;

    @Builder.Default
    private String status = "PENDING"; // PENDING | DONE

    // When the notification becomes actionable (now for releases, +14 days for desk holds)
    private LocalDate dueAt;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
