package com.square.backend.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Audit record of one Excel/CSV import run — who was added, when, from which
 * file, and whether the AI assistant had to get involved.
 */
@Entity
@Table(name = "import_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fileName;

    // Success | Resolved via AI Chat | Failed
    private String status;

    private int recordsAdded;
    private int recordsSkipped;

    // One line per record, e.g. "Nadim Chowdury → Commercial as Executive"
    @Column(columnDefinition = "TEXT")
    private String details;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
