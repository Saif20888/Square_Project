package com.square.backend.repository;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetStatus;
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