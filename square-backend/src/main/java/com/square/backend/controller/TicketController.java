package com.square.backend.controller;

import com.square.backend.model.Ticket;
import com.square.backend.repository.TicketRepository;
import com.square.backend.repository.UserRepository;
import com.square.backend.service.TicketService;
import com.square.backend.web.Paging;
import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import com.square.backend.security.CurrentUser;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private TicketService ticketService;

    @Autowired
    private UserRepository userRepository;

    // Plain array by default; ?page=0&size=50 pages, totals in X-Total-* headers.
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllTickets(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page == null) {
            return Paging.all(ticketRepository.findAll().stream().map(this::toView).collect(Collectors.toList()));
        }
        return Paging.page(ticketRepository.findAll(Paging.request(page, size)).map(this::toView));
    }

    // Every ticket routes straight to IT — no priority, no supervisor approval gate.
    @PostMapping
    public ResponseEntity<Map<String, Object>> createTicket(@RequestBody Ticket ticket) {
        // The body is otherwise trusted as-is (no DTO layer here), but the id must
        // never come from the client — a client-supplied id makes Spring Data
        // resolve the save() as an update instead of an insert, silently
        // overwriting and reassigning whatever ticket already has that id.
        ticket.setId(null);
        if (ticket.getProblemType() == null || ticket.getProblemType().isEmpty()) {
            ticket.setProblemType("Other");
        }
        if (ticket.getDescription() == null || ticket.getDescription().isEmpty()) {
            ticket.setDescription(ticket.getProblemType());
        }
        ticket.setRaisedByUsername(CurrentUser.username());
        ticket.setStatus("OPEN");
        ticket.setAcceptedBy(null);
        ticket.setResolvedAt(null);

        Ticket savedTicket = ticketRepository.save(ticket);
        return ResponseEntity.ok(toView(savedTicket));
    }

    // A technician accepts an open ticket, naming who's working it — any IT Team
    // member, not necessarily the caller (triage hands tickets to teammates), but
    // it has to actually be a real IT Team member, not an arbitrary string.
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/accept")
    public ResponseEntity<Map<String, Object>> acceptTicket(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String acceptedBy = body.get("acceptedBy");
        if (acceptedBy == null || !userRepository.existsByRoleAndName(Roles.IT_TECH, acceptedBy)) {
            throw new BadRequestException("acceptedBy must be a current IT Team member.");
        }
        try {
            return ResponseEntity.ok(toView(ticketService.acceptTicket(id, acceptedBy)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // A technician rejects an open ticket
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectTicket(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(toView(ticketService.rejectTicket(id)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // A technician marks a ticket they're solving as resolved
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/resolve")
    public ResponseEntity<Map<String, Object>> resolveTicket(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(toView(ticketService.resolveTicket(id)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private Map<String, Object> toView(Ticket t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("raisedByUsername", t.getRaisedByUsername());
        m.put("location", t.getLocation());
        m.put("floor", t.getFloor());
        m.put("department", t.getDepartment());
        m.put("problemType", t.getProblemType());
        m.put("description", t.getDescription());
        m.put("assetId", t.getAssetId());
        m.put("status", t.getStatus());
        m.put("acceptedBy", t.getAcceptedBy());
        m.put("createdAt", t.getCreatedAt());
        m.put("resolvedAt", t.getResolvedAt());
        return m;
    }
}
