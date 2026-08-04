package com.square.backend.service;

import com.square.backend.model.Ticket;
import com.square.backend.repository.TicketRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
public class TicketService {

    @Autowired
    private TicketRepository ticketRepository;

    // A technician accepts an open ticket and starts working on it
    public Ticket acceptTicket(Long id, String acceptedBy) {
        return ticketRepository.findById(id).map(ticket -> {
            ticket.setStatus("SOLVING");
            ticket.setAcceptedBy(acceptedBy);
            return ticketRepository.save(ticket);
        }).orElseThrow(() -> new RuntimeException("Ticket not found with ID: " + id));
    }

    // A technician rejects an open ticket, closing it out
    public Ticket rejectTicket(Long id) {
        return ticketRepository.findById(id).map(ticket -> {
            ticket.setStatus("REJECTED");
            ticket.setResolvedAt(LocalDateTime.now());
            return ticketRepository.save(ticket);
        }).orElseThrow(() -> new RuntimeException("Ticket not found with ID: " + id));
    }

    // A technician marks a ticket they're solving as resolved
    public Ticket resolveTicket(Long id) {
        return ticketRepository.findById(id).map(ticket -> {
            ticket.setStatus("CLOSED");
            ticket.setResolvedAt(LocalDateTime.now());
            return ticketRepository.save(ticket);
        }).orElseThrow(() -> new RuntimeException("Ticket not found with ID: " + id));
    }
}
