package com.square.backend.repository;

import com.square.backend.model.OffboardingRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OffboardingRepository extends JpaRepository<OffboardingRecord, Long> {
    Optional<OffboardingRecord> findFirstByEmployeeUsernameOrderByCreatedAtDesc(String employeeUsername);
}
