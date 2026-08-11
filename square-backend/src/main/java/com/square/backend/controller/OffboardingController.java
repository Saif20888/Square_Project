package com.square.backend.controller;

import com.square.backend.model.OffboardingDecision;
import com.square.backend.model.OffboardingRecord;
import com.square.backend.repository.OffboardingRepository;
import com.square.backend.service.OffboardingService;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/offboarding")
@RequiresRole({ Roles.SUPERVISOR })
public class OffboardingController {

    @Autowired
    private OffboardingService offboardingService;

    @Autowired
    private OffboardingRepository offboardingRepository;

    @PostMapping
    public ResponseEntity<?> createPlan(@RequestBody Map<String, String> body) {
        try {
            String employeeUsername = body.get("employeeUsername");
            OffboardingDecision decision = OffboardingDecision.valueOf(body.get("decision"));
            String note = body.get("note");
            OffboardingRecord record = offboardingService.createPlan(employeeUsername, decision, note);
            return ResponseEntity.ok(record);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getCurrentPlan(@RequestParam String employee) {
        return offboardingRepository.findFirstByEmployeeUsernameOrderByCreatedAtDesc(employee)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }
}
