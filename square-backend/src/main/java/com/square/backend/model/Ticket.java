package com.square.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tickets")
public class Ticket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String raisedByUsername;   // who submitted this ticket

    // Where the problem is
    private String location;           // Anita Center (HQ) / Sector 3 Office / CSQ / Bay Tower
    private int floor;
    private String department;

    // What the problem is
    private String problemType;        // one of the preset options, or "Other"
    private String description;        // preset label, or the custom-typed text when problemType is "Other"
    private Long assetId;              // the employee's device, when problemType is "Hardware Malfunction"

    private String status;             // OPEN, SOLVING, CLOSED, REJECTED
    private String acceptedBy;         // technician's name once accepted

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime resolvedAt;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRaisedByUsername() { return raisedByUsername; }
    public void setRaisedByUsername(String raisedByUsername) { this.raisedByUsername = raisedByUsername; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public int getFloor() { return floor; }
    public void setFloor(int floor) { this.floor = floor; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getProblemType() { return problemType; }
    public void setProblemType(String problemType) { this.problemType = problemType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Long getAssetId() { return assetId; }
    public void setAssetId(Long assetId) { this.assetId = assetId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAcceptedBy() { return acceptedBy; }
    public void setAcceptedBy(String acceptedBy) { this.acceptedBy = acceptedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}
