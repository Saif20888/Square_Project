package com.square.backend.repository;

import com.square.backend.model.AssetHistoryEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssetHistoryRepository extends JpaRepository<AssetHistoryEntry, Long> {

    List<AssetHistoryEntry> findByAssetIdOrderByAtDesc(Long assetId);
}
