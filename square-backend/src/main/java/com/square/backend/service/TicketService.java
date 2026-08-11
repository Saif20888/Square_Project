package com.square.backend.service;

import com.square.backend.model.Ticket;
import com.square.backend.repository.TicketRepository;
import com.square.backend.web.ApiExceptionHandler.ConflictException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.NoSuchElementException;

@Service
public class TicketService {

    @Autowired
    private TicketRepository ticketRepository;

    private Ticket find(Long id) {
        return ticketRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Ticket not found with ID: " + id));
    }

    private void requireStatus(Ticket ticket, String required, String action) {
        if (!required.equals(ticket.getStatus())) {
            throw new ConflictException("Can't " + action + " — this ticket is currently " + ticket.getStatus() + ".");
        }
    }

    // A technician accepts an open ticket and starts working on it
    public Ticket acceptTicket(Long id, String acceptedBy) {
        Ticket ticket = find(id);
        requireStatus(ticket, "OPEN", "accept");
        ticket.setStatus("SOLVING");
        ticket.setAcceptedBy(acceptedBy);
        return ticketRepository.save(ticket);
    }

    // A technician rejects an open ticket, closing it out
    public Ticket rejectTicket(Long id) {
        Ticket ticket = find(id);
        requireStatus(ticket, "OPEN", "reject");
        ticket.setStatus("REJECTED");
        ticket.setResolvedAt(LocalDateTime.now());
        return ticketRepository.save(ticket);
    }

    // A technician marks a ticket they're solving as resolved
    public Ticket resolveTicket(Long id) {
        Ticket ticket = find(id);
        requireStatus(ticket, "SOLVING", "resolve");
        ticket.setStatus("CLOSED");
        ticket.setResolvedAt(LocalDateTime.now());
        return ticketRepository.save(ticket);
    }
}
