package com.square.backend.repository;

import com.square.backend.model.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {
    // Relying on standard findAll() to let the React view handle filters dynamically
}