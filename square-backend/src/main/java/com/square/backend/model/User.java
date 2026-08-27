package com.square.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String role; // EMPLOYEE, SUPERVISOR, IT_TECH, SYSTEM_ADMIN

    private String name;
    private String jobTitle;

    // Company-wide unique identifier (e.g. SQ-EMP-0001) — employees are recognized
    // by their unique ID, department and name.
    @Column(unique = true)
    private String employeeId;
    private String department;

    // Only for the "HR and Admin" umbrella department: HR, Admin or IT
    private String unit;

    // Set true once a supervisor offboards this employee; hides them from rosters.
    private boolean offboarded;

    // Contact info shown on the Superuser's roster
    private String email;
    private String phone;
    // Company-issued phone number, distinct from the employee's personal mobile
    private String officialNumber;

    // Onboarding details captured by the Superuser's 2-step form
    private LocalDate dob;
    private String mobile;
    private String location;   // Anita Center (HQ) / Sector 3 Office / CSQ / Bay Tower
    private Integer floor;

    // First working day — used to compute years of service
    private LocalDate joinedAt;

    // Username of this user's supervisor; null for supervisors/admins/techs.
    private String managerUsername;

    // Tenant scaffold for a future SaaS split — unused today, not enforced.
    private Long organizationId;

    // 1.(Strictly required by JPA/Hibernate specs)
    public User() {
    }

    // 2.(Required for automatic seeding in BackendApplication.java)
    public User(String username, String password, String role) {
        this.username = username;
        this.password = password;
        this.role = role;
    }

    // --- Standard Getters and Setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String jobTitle) { this.jobTitle = jobTitle; }
    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public boolean isOffboarded() { return offboarded; }
    public void setOffboarded(boolean offboarded) { this.offboarded = offboarded; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getOfficialNumber() { return officialNumber; }
    public void setOfficialNumber(String officialNumber) { this.officialNumber = officialNumber; }
    public LocalDate getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDate joinedAt) { this.joinedAt = joinedAt; }
    public LocalDate getDob() { return dob; }
    public void setDob(LocalDate dob) { this.dob = dob; }
    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public Integer getFloor() { return floor; }
    public void setFloor(Integer floor) { this.floor = floor; }
    public String getManagerUsername() { return managerUsername; }
    public void setManagerUsername(String managerUsername) { this.managerUsername = managerUsername; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
}