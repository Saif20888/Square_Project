package com.square.backend.controller;

import com.square.backend.model.ImportLog;
import com.square.backend.repository.ImportLogRepository;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Import history — every Excel/CSV import run, newest first, with drill-down details. */
@RestController
@RequestMapping("/api/import-logs")
@RequiresRole({ Roles.SUPERVISOR })
public class ImportLogController {

    @Autowired
    private ImportLogRepository importLogRepository;

    @GetMapping
    public List<Map<String, Object>> getAll() {
        return importLogRepository.findAllByOrderByCreatedAtDesc().stream().map(this::toView).collect(Collectors.toList());
    }

    @PostMapping
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body) {
        List<String> details = body.get("details") instanceof List ? (List<String>) body.get("details") : List.of();
        ImportLog log = ImportLog.builder()
                .fileName(body.get("fileName") == null ? "unknown" : body.get("fileName").toString())
                .status(body.get("status") == null ? "Success" : body.get("status").toString())
                .recordsAdded(parseInt(body.get("recordsAdded")))
                .recordsSkipped(parseInt(body.get("recordsSkipped")))
                .details(String.join("\n", details))
                .build();
        return ResponseEntity.ok(toView(importLogRepository.save(log)));
    }

    private Map<String, Object> toView(ImportLog l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("fileName", l.getFileName());
        m.put("status", l.getStatus());
        m.put("recordsAdded", l.getRecordsAdded());
        m.put("recordsSkipped", l.getRecordsSkipped());
        m.put("details", l.getDetails() == null || l.getDetails().isEmpty() ? List.of() : List.of(l.getDetails().split("\n")));
        m.put("createdAt", l.getCreatedAt());
        return m;
    }

    private int parseInt(Object o) {
        try { return o == null ? 0 : Integer.parseInt(o.toString()); } catch (NumberFormatException e) { return 0; }
    }
}
