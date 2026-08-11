package com.square.backend.controller;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetStatus;
import com.square.backend.model.Notification;
import com.square.backend.model.User;
import com.square.backend.repository.AssetRepository;
import com.square.backend.repository.DepartmentRepository;
import com.square.backend.repository.LocationRepository;
import com.square.backend.repository.NotificationRepository;
import com.square.backend.repository.UserRepository;
import com.square.backend.security.CurrentUser;
import com.square.backend.service.AuditService;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import com.square.backend.security.TokenStore;
import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import com.square.backend.web.Paging;
import com.square.backend.web.Validate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;


import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Directory (no passwords exposed) used by the frontend, plus the Superuser's
 * onboarding endpoint and self-service profile / password updates.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private LocationRepository locationRepository;

    @Autowired
    private TokenStore tokenStore;

    @Autowired
    private AuditService audit;

    @Autowired
    private PasswordEncoder encoder;

    // Returns a plain array, as it always has. Add ?page=0&size=50 to page
    // through instead; the totals come back in the X-Total-* headers.
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllUsers(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page == null) {
            return Paging.all(userRepository.findAll().stream().map(this::toView).collect(Collectors.toList()));
        }
        return Paging.page(userRepository.findAll(Paging.request(page, size)).map(this::toView));
    }

    // Superuser onboarding — creates the account (username = e-mail, with the
    // generated temporary password) and, if a device was allocated, the asset.
    @RequiresRole({ Roles.SUPERVISOR })
    @PostMapping
    // Creates the User and (optionally) the Asset as two separate saves — without
    // this, a failure partway through leaves an account with no device or vice versa.
    @Transactional
    public ResponseEntity<?> onboard(@RequestBody Map<String, Object> body) {
        // Guards throw BadRequestException, which ApiExceptionHandler turns into a 400
        String email = Validate.email(str(body.get("email")), "E-mail");
        String employeeId = Validate.optionalText(str(body.get("employeeId")), "Employee ID");
        // Generated here, not trusted from the client — the onboarding form used to
        // make one up itself with a "TempPassNNN!" pattern (900 possibilities, plain
        // Math.random()). Reset-password already does this properly; match it.
        String tempPassword = Validate.temporaryPassword();
        Validate.optionalText(str(body.get("name")), "Name");
        if (userRepository.findByUsername(email).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("message", "An account with this e-mail already exists."));
        }
        if (employeeId != null && userRepository.existsByEmployeeIdIgnoreCase(employeeId)) {
            return ResponseEntity.status(409).body(Map.of("message", "This Employee ID is already in use."));
        }
        // The frontend only ever offers these from the org-structure dropdowns, but
        // a direct API call could send anything — checked here as defense-in-depth,
        // not because the UI needs it.
        requireKnownDepartment(str(body.get("department")));
        requireKnownLocation(str(body.get("location")));

        // Within HR and Admin, the IT unit joins the IT Team; everyone else is a User
        String unit = deriveUnit(str(body.get("department")), str(body.get("unit")));
        String role = deriveRole(unit, str(body.get("employeeType")));
        User u = new User(email, encoder.encode(tempPassword), role);
        u.setName(str(body.get("name")));
        u.setEmployeeId(employeeId);
        u.setJobTitle(str(body.get("designation")));
        u.setDepartment(str(body.get("department")));
        u.setUnit(unit);
        u.setEmail(email);
        u.setMobile(str(body.get("mobile")));
        u.setPhone(str(body.get("phone")));
        u.setDob(parseDate(body.get("dob")));
        u.setLocation(str(body.get("location")));
        u.setFloor(parseInt(body.get("floor")));
        u.setManagerUsername(str(body.get("managerUsername")));
        u.setJoinedAt(LocalDate.now());
        User saved = userRepository.save(u);
        audit.record(AuditService.EMPLOYEE_ONBOARDED, saved.getUsername(),
                "Onboarded as " + saved.getJobTitle() + " in " + saved.getDepartment());

        // Workspace device allocated during onboarding — captures the same fields
        // as the employee "Add device" popup so asset records never conflict.
        String deviceName = str(body.get("deviceName"));
        if (deviceName != null) {
            String assetNumber = str(body.get("assetNumber"));
            String serial = assetNumber != null ? assetNumber
                    : "SQ-" + (employeeId != null ? employeeId : "U" + saved.getId());
            double price = 0;
            try { if (body.get("originalValue") != null) price = Double.parseDouble(body.get("originalValue").toString()); } catch (NumberFormatException ignored) {}
            LocalDate warranty = parseDate(body.get("warrantyExpiry"));
            assetRepository.save(Asset.builder()
                    .serialNumber(serial)
                    .deviceType(deviceName)
                    .deviceKind(str(body.get("deviceKind")))
                    .ipAddress(str(body.get("ipAddress")))
                    .assetCategory(str(body.get("assetCategory")))
                    .assetNumber(assetNumber)
                    .prNumber(str(body.get("prNumber")))
                    .supplierName(str(body.get("supplierName")))
                    .department(str(body.get("department")))
                    .status(AssetStatus.ALLOCATED_IN_USE)
                    .purchaseDate(LocalDate.now())
                    .warrantyExpiry(warranty != null ? warranty : LocalDate.now().plusDays(365))
                    .originalValue(price)
                    .usefulLifeYears(4)
                    .userId(saved.getId())
                    .build());
        }
        Map<String, Object> view = toView(saved);
        view.put("tempPassword", tempPassword);
        return ResponseEntity.ok(view);
    }

    // Self-service profile edit from the My Account tab, and the Superuser's
    // "manage employee" panel (department / designation / place of work).
    @PutMapping("/{id}")
    public ResponseEntity<?> updateProfile(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        // You may edit your own contact details; only a Superuser may edit
        // someone else's, or change the fields that define where a person sits
        // in the organization (designation, department, unit).
        boolean manager = CurrentUser.hasRole(Roles.SUPERVISOR);
        if (!manager && !CurrentUser.isSelfOrAdmin(id)) {
            return ResponseEntity.status(403).body(Map.of("message", "You can only edit your own profile."));
        }
        if (!manager && (body.containsKey("jobTitle") || body.containsKey("department") || body.containsKey("unit"))) {
            return ResponseEntity.status(403).body(Map.of("message",
                    "Designation, department and unit are changed by the Superuser."));
        }
        return userRepository.findById(id).<ResponseEntity<?>>map(u -> {
            if (body.containsKey("name")) u.setName(str(body.get("name")));
            if (body.containsKey("dob")) u.setDob(parseDate(body.get("dob")));
            if (body.containsKey("mobile")) u.setMobile(str(body.get("mobile")));
            if (body.containsKey("phone")) u.setPhone(str(body.get("phone")));
            if (body.containsKey("location")) {
                requireKnownLocation(str(body.get("location")));
                u.setLocation(str(body.get("location")));
            }
            if (body.containsKey("floor")) u.setFloor(parseInt(body.get("floor")));
            if (body.containsKey("jobTitle")) u.setJobTitle(str(body.get("jobTitle")));
            if (body.containsKey("department")) {
                requireKnownDepartment(str(body.get("department")));
                u.setDepartment(str(body.get("department")));
            }
            if (body.containsKey("unit")) u.setUnit("HR and Admin".equals(u.getDepartment()) ? str(body.get("unit")) : null);
            User saved = userRepository.save(u);
            // Self-edits of your own contact details aren't privileged; only a
            // Superuser changing someone's position/place in the org is audit-worthy.
            if (manager) {
                audit.record(AuditService.PROFILE_UPDATED, saved.getUsername(),
                        "Updated by " + CurrentUser.username() + " — " + saved.getJobTitle() + " · " + saved.getDepartment());
            }
            return ResponseEntity.ok(toView(saved));
        }).orElse(ResponseEntity.notFound().build());
    }

    // Password change from the My Account tab — verifies the current password
    // against its BCrypt hash and stores the new one hashed.
    @PutMapping("/{id}/password")
    public ResponseEntity<?> changePassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        // Only your own password. Someone else's is reset by the Superuser
        // through /reset-password, which issues a temporary one instead.
        if (!CurrentUser.isSelfOrAdmin(id)) {
            return ResponseEntity.status(403).body(Map.of("message", "You can only change your own password."));
        }
        return userRepository.findById(id).<ResponseEntity<?>>map(u -> {
            String current = body.get("currentPassword");
            String next = body.get("newPassword");
            if (current == null || !encoder.matches(current, u.getPassword())) {
                return ResponseEntity.status(400).body(Map.of("message", "Current password is incorrect."));
            }
            if (next == null || next.length() < 8) {
                return ResponseEntity.status(400).body(Map.of("message", "New password must be at least 8 characters long."));
            }
            u.setPassword(encoder.encode(next));
            userRepository.save(u);
            // Every session opened with the old password is no longer trusted —
            // including the one making this request — so issue a fresh token in the
            // same response. Without this the browser keeps using the now-revoked
            // token and gets bounced to login with a confusing "session expired"
            // error seconds after being told the change succeeded.
            tokenStore.revokeAllFor(u.getUsername());
            String freshToken = tokenStore.issue(u);
            audit.record(AuditService.PASSWORD_CHANGED, u.getUsername(), "Changed their own password");
            return ResponseEntity.ok(Map.of("status", "SUCCESS", "token", freshToken));
        }).orElse(ResponseEntity.notFound().build());
    }

    // Superuser resets a forgotten password: generates a temporary one, stores it
    // hashed, closes the reset request, and shows the temp password ONCE.
    @RequiresRole({ Roles.SUPERVISOR })
    @PostMapping("/{id}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable Long id) {
        return userRepository.findById(id).<ResponseEntity<?>>map(u -> {
            String temp = Validate.temporaryPassword();
            u.setPassword(encoder.encode(temp));
            userRepository.save(u);
            tokenStore.revokeAllFor(u.getUsername());
            for (Notification n : notificationRepository.findByStatusAndTypeAndEmployeeUsername(
                    "PENDING", "PASSWORD_RESET", u.getUsername())) {
                n.setStatus("DONE");
                notificationRepository.save(n);
            }
            audit.record(AuditService.PASSWORD_RESET, u.getUsername(),
                    "Issued a temporary password to " + (u.getName() == null ? u.getUsername() : u.getName()));
            return ResponseEntity.ok(Map.of("tempPassword", temp, "username", u.getUsername()));
        }).orElse(ResponseEntity.notFound().build());
    }

    private Map<String, Object> toView(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("name", u.getName());
        m.put("role", u.getRole());
        m.put("employeeId", u.getEmployeeId());
        m.put("department", u.getDepartment());
        m.put("unit", u.getUnit());
        m.put("offboarded", u.isOffboarded());
        m.put("jobTitle", u.getJobTitle());
        m.put("location", u.getLocation());
        m.put("floor", u.getFloor());
        m.put("joinedAt", u.getJoinedAt());
        m.put("managerUsername", u.getManagerUsername());
        // DOB/personal mobile/phone/e-mail are for the Superuser's roster and each
        // person's own record — the directory itself (open to every signed-in
        // person) doesn't need to carry them for everyone else's row.
        if (CurrentUser.isSelfOrAdmin(u.getId()) || CurrentUser.hasRole(Roles.SUPERVISOR)) {
            m.put("email", u.getEmail());
            m.put("phone", u.getPhone());
            m.put("mobile", u.getMobile());
            m.put("dob", u.getDob());
        }
        return m;
    }

    private String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    // A "unit" only exists within the HR and Admin department (HR / Admin / IT) —
    // anyone else's unit field is meaningless and dropped.
    static String deriveUnit(String department, String unit) {
        return "HR and Admin".equals(department) ? unit : null;
    }

    // IT_TECH grants real authority over repair/loan/receive endpoints, so this
    // decides who gets it: either the IT unit within HR and Admin, or an explicit
    // "IT Team" employee type for departments that don't use the unit system.
    // Being in a department merely named "IT" grants nothing on its own — it has
    // to come through one of these two paths.
    static String deriveRole(String unit, String employeeType) {
        return "IT".equals(unit) || "IT Team".equals(employeeType) ? Roles.IT_TECH : Roles.EMPLOYEE;
    }

    private void requireKnownDepartment(String name) {
        if (name != null && departmentRepository.findByNameIgnoreCase(name).isEmpty()) {
            throw new BadRequestException("Unknown department: " + name);
        }
    }

    private void requireKnownLocation(String name) {
        if (name != null && locationRepository.findByNameIgnoreCase(name).isEmpty()) {
            throw new BadRequestException("Unknown office: " + name);
        }
    }

    private LocalDate parseDate(Object o) {
        String s = str(o);
        try { return s == null ? null : LocalDate.parse(s); } catch (Exception e) { return null; }
    }

    private Integer parseInt(Object o) {
        String s = str(o);
        try { return s == null ? null : Integer.valueOf(s); } catch (NumberFormatException e) { return null; }
    }
}
