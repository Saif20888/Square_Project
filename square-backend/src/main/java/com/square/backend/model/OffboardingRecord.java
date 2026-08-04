package com.square.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "offboarding_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OffboardingRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String employeeUsername;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OffboardingDecision decision;

    private String note;

    // Set only for RETAIN_14_DAY: createdAt + 14 days
    private LocalDate holdUntil;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
