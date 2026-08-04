package com.square.backend.controller;

import com.square.backend.model.AuditEvent;
import com.square.backend.repository.AuditEventRepository;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only view of the audit trail. Restricted to the Superuser and the System
 * admin — the whole point of the trail is that the people it records cannot
 * quietly inspect or shape it.
 */
@RestController
@RequestMapping("/api/audit")
@RequiresRole({ Roles.SUPERVISOR })
public class AuditController {

    @Autowired
    private AuditEventRepository repository;

    /**
     * Most recent events first. Optionally filtered by action or by who did it;
     * capped so a long history can never return an unbounded response.
     */
    @GetMapping
    public List<AuditEvent> recent(@RequestParam(required = false) String action,
                                   @RequestParam(required = false) String actor,
                                   @RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "100") int size) {
        int capped = Math.min(Math.max(size, 1), 200);
        var pageable = PageRequest.of(Math.max(page, 0), capped);
        if (action != null && !action.isBlank()) {
            return repository.findByActionOrderByAtDesc(action.trim(), pageable).getContent();
        }
        if (actor != null && !actor.isBlank()) {
            return repository.findByActorUsernameOrderByAtDesc(actor.trim(), pageable).getContent();
        }
        return repository.findTop200ByOrderByAtDesc();
    }
}
