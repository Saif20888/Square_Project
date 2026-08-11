package com.square.backend.service;

import com.square.backend.model.Ticket;
import com.square.backend.repository.TicketRepository;
import com.square.backend.web.ApiExceptionHandler.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * The ticket lifecycle (OPEN -> SOLVING -> CLOSED/REJECTED) had no guard at
 * all before this: any of the three transitions could fire from any status,
 * including re-accepting an already-closed ticket or resolving one that was
 * never accepted.
 */
@ExtendWith(MockitoExtension.class)
class TicketServiceTest {

    @Mock private TicketRepository ticketRepository;
    @InjectMocks private TicketService service;

    private Ticket ticket(String status) {
        Ticket t = new Ticket();
        t.setId(1L);
        t.setStatus(status);
        return t;
    }

    @BeforeEach
    void stubSave() {
        lenient().when(ticketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void acceptingAnOpenTicketMovesItToSolving() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket("OPEN")));
        Ticket result = service.acceptTicket(1L, "Arif Chowdhury");
        assertEquals("SOLVING", result.getStatus());
        assertEquals("Arif Chowdhury", result.getAcceptedBy());
    }

    @Test
    void acceptingAnAlreadyClosedTicketIsRejected() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket("CLOSED")));
        assertThrows(ConflictException.class, () -> service.acceptTicket(1L, "Arif Chowdhury"));
    }

    @Test
    void rejectingATicketThatIsAlreadyRejectedIsRejected() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket("REJECTED")));
        assertThrows(ConflictException.class, () -> service.rejectTicket(1L));
    }

    @Test
    void resolvingAStillOpenTicketIsRejected() {
        // Without this guard a ticket could be "resolved" with no one ever
        // having accepted it — closed by nobody.
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket("OPEN")));
        assertThrows(ConflictException.class, () -> service.resolveTicket(1L));
    }

    @Test
    void resolvingATicketBeingSolvedSucceeds() {
        when(ticketRepository.findById(1L)).thenReturn(Optional.of(ticket("SOLVING")));
        Ticket result = service.resolveTicket(1L);
        assertEquals("CLOSED", result.getStatus());
        assertNotNull(result.getResolvedAt());
    }

    @Test
    void missingTicketIsReportedAsNotFoundNotAConflict() {
        when(ticketRepository.findById(99L)).thenReturn(Optional.empty());
        assertThrows(NoSuchElementException.class, () -> service.acceptTicket(99L, "Anyone"));
    }
}
