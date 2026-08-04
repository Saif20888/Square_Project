package com.square.backend.controller;

import com.square.backend.model.Notification;
import com.square.backend.repository.NotificationRepository;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Pending notifications for the IT Team dashboard (device releases from
 * offboarding, and 14-day desk-collection reminders). Notifications are marked
 * DONE when the related device is received into storage.
 */
@RestController
@RequestMapping("/api/notifications")
@RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })

    public class NotificationController {

    @Autowired
    private NotificationRepository notificationRepository;

    @GetMapping
    public List<Notification> getPending() {
        return notificationRepository.findByStatusOrderByDueAtAsc("PENDING");
    }
}
