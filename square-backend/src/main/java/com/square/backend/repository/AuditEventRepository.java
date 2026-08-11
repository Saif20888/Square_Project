package com.square.backend.repository;

import com.square.backend.model.AuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    Page<AuditEvent> findAllByOrderByAtDesc(Pageable pageable);

    Page<AuditEvent> findByActionOrderByAtDesc(String action, Pageable pageable);

    Page<AuditEvent> findByActorUsernameOrderByAtDesc(String actorUsername, Pageable pageable);
}
