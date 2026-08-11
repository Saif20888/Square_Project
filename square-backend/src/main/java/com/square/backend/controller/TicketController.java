package com.square.backend.controller;

import com.square.backend.model.Ticket;
import com.square.backend.repository.TicketRepository;
import com.square.backend.service.TicketService;
import com.square.backend.web.Paging;
import com.square.backend.security.CurrentUser;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private TicketService ticketService;

    // Plain array by default; ?page=0&size=50 pages, totals in X-Total-* headers.
    @GetMapping
    public ResponseEntity<List<Ticket>> getAllTickets(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page == null) return Paging.all(ticketRepository.findAll());
        return Paging.page(ticketRepository.findAll(Paging.request(page, size)));
    }

    // Every ticket routes straight to IT — no priority, no supervisor approval gate.
    @PostMapping
    public ResponseEntity<?> createTicket(@RequestBody Ticket ticket) {
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
        return ResponseEntity.ok(savedTicket);
    }

    // A technician accepts an open ticket, naming who's working it
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/accept")
    public ResponseEntity<Ticket> acceptTicket(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(ticketService.acceptTicket(id, body.get("acceptedBy")));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // A technician rejects an open ticket
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/reject")
    public ResponseEntity<Ticket> rejectTicket(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(ticketService.rejectTicket(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // A technician marks a ticket they're solving as resolved
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/resolve")
    public ResponseEntity<Ticket> resolveTicket(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(ticketService.resolveTicket(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
