package com.square.backend.repository;

import com.square.backend.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByStatusOrderByDueAtAsc(String status);
    List<Notification> findByAssetIdAndStatus(Long assetId, String status);
}
