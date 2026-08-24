package com.square.backend.repository;

import com.square.backend.model.StockHistoryEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockHistoryRepository extends JpaRepository<StockHistoryEntry, Long> {

    List<StockHistoryEntry> findByStockItemIdOrderByAtDesc(Long stockItemId);
}
