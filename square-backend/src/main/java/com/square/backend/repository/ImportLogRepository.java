package com.square.backend.repository;

import com.square.backend.model.ImportLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ImportLogRepository extends JpaRepository<ImportLog, Long> {
    List<ImportLog> findAllByOrderByCreatedAtDesc();
}
