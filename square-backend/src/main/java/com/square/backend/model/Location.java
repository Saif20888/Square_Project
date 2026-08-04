package com.square.backend.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * An office managed by the Superuser (e.g. "Anita Center (HQ)" with 11 floors).
 * Locations and their floor counts drive every location/floor dropdown in the app.
 */
@Entity
@Table(name = "locations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    private int floors;
}
