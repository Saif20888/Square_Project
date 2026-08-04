package com.square.backend.controller;

import com.square.backend.model.Department;
import com.square.backend.model.Location;
import com.square.backend.repository.DepartmentRepository;
import com.square.backend.repository.LocationRepository;
import com.square.backend.web.Validate;
import com.square.backend.service.AuditService;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Organization structure managed by the Superuser: offices (with floor counts)
 * and departments. Every dropdown in the app is driven by these lists, so the
 * Superuser can reshape the company without a developer.
 */
@RestController
@RequestMapping("/api/org")
public class OrgController {

    /** Upper bound for an office's floor count (the tallest real site has 11). */
    private static final int MAX_FLOORS = 200;

    @Autowired
    private AuditService audit;

    @Autowired
    private LocationRepository locationRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    // --- Offices ---
    @GetMapping("/locations")
    public List<Location> getLocations() {
        return locationRepository.findAll();
    }

    @RequiresRole({ Roles.SUPERVISOR })
    @PostMapping("/locations")
    public ResponseEntity<?> addLocation(@RequestBody Map<String, Object> body) {
        String name = Validate.requiredText(body.get("name") == null ? null : body.get("name").toString(), "Office name");
        int floors = 6;
        try { if (body.get("floors") != null) floors = Integer.parseInt(body.get("floors").toString()); } catch (NumberFormatException ignored) {}
        // Clamped: the frontend builds a dropdown with one entry per floor, so an
        // unbounded value here would freeze the browser.
        floors = Math.min(MAX_FLOORS, Math.max(1, floors));
        if (locationRepository.findByNameIgnoreCase(name).isPresent())
            return ResponseEntity.status(409).body(Map.of("message", "This office already exists."));
        Location saved = locationRepository.save(Location.builder().name(name).floors(floors).build());
        audit.record(AuditService.ORG_CHANGED, name, "Added office with " + floors + " floors");
        return ResponseEntity.ok(saved);
    }

    @RequiresRole({ Roles.SUPERVISOR })
    @DeleteMapping("/locations/{id}")
    public ResponseEntity<?> deleteLocation(@PathVariable Long id) {
        if (!locationRepository.existsById(id)) return ResponseEntity.notFound().build();
        locationRepository.deleteById(id);
        audit.record(AuditService.ORG_CHANGED, "location:" + id, "Removed an office");
        return ResponseEntity.ok(Map.of("status", "DELETED"));
    }

    // --- Departments ---
    @GetMapping("/departments")
    public List<Department> getDepartments() {
        return departmentRepository.findAll();
    }

    @RequiresRole({ Roles.SUPERVISOR })
    @PostMapping("/departments")
    public ResponseEntity<?> addDepartment(@RequestBody Map<String, String> body) {
        String name = Validate.requiredText(body.get("name"), "Department name");
        if (departmentRepository.findByNameIgnoreCase(name).isPresent())
            return ResponseEntity.status(409).body(Map.of("message", "This department already exists."));
        Department saved = departmentRepository.save(Department.builder().name(name).build());
        audit.record(AuditService.ORG_CHANGED, name, "Added department");
        return ResponseEntity.ok(saved);
    }

    @RequiresRole({ Roles.SUPERVISOR })
    @DeleteMapping("/departments/{id}")
    public ResponseEntity<?> deleteDepartment(@PathVariable Long id) {
        if (!departmentRepository.existsById(id)) return ResponseEntity.notFound().build();
        departmentRepository.deleteById(id);
        audit.record(AuditService.ORG_CHANGED, "department:" + id, "Removed a department");
        return ResponseEntity.ok(Map.of("status", "DELETED"));
    }
}
