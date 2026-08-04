package com.square.backend.repository; // Added .backend here

import com.square.backend.model.Asset;       // Added .backend here
import com.square.backend.model.AssetStatus; // Added .backend here
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AssetRepository extends JpaRepository<Asset, Long> {
    
    Optional<Asset> findBySerialNumber(String serialNumber);
    
    List<Asset> findByStatus(AssetStatus status);
    
    List<Asset> findByUserId(Long userId);
}