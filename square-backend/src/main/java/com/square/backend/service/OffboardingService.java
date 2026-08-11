package com.square.backend.service;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetStatus;
import com.square.backend.model.Notification;
import com.square.backend.model.OffboardingDecision;
import com.square.backend.model.OffboardingRecord;
import com.square.backend.model.User;
import com.square.backend.repository.AssetRepository;
import com.square.backend.repository.NotificationRepository;
import com.square.backend.repository.OffboardingRepository;
import com.square.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;

@Service
public class OffboardingService {

    @Autowired
    private OffboardingRepository offboardingRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private AssetRepository assetRepository;
    @Autowired
    private NotificationRepository notificationRepository;

    // Several independent writes below (the record, the employee flag, per-asset
    // status/notifications) — without this, a failure partway through leaves the
    // employee flagged offboarded with only some of their devices handled.
    @Transactional
    public OffboardingRecord createPlan(String employeeUsername, OffboardingDecision decision, String note) {
        OffboardingRecord record = OffboardingRecord.builder()
                .employeeUsername(employeeUsername)
                .decision(decision)
                .note(note)
                .holdUntil(decision == OffboardingDecision.RETAIN_14_DAY ? LocalDate.now().plusDays(14) : null)
                .build();
        record = offboardingRepository.save(record);

        User employee = userRepository.findByUsername(employeeUsername)
                .orElseThrow(() -> new RuntimeException("User not found: " + employeeUsername));

        // Offboarded employees disappear from the supervisor's roster.
        employee.setOffboarded(true);
        userRepository.save(employee);

        String who = employee.getName() != null ? employee.getName() : employeeUsername;
        for (Asset asset : assetRepository.findByUserId(employee.getId())) {
            if (asset.getStatus() == AssetStatus.IN_REPAIR) {
                // Still physically at the shop. Clear ownership now so repairReturn()
                // naturally routes it back to the pool instead of re-assigning it to
                // the now-terminated account, and flag IT so it isn't forgotten.
                asset.setUserId(null);
                assetRepository.save(asset);
                notificationRepository.save(Notification.builder()
                        .type("REPAIR_OWNER_OFFBOARDED")
                        .message(who + " was offboarded while " + asset.getSerialNumber() + " (" + asset.getDeviceType() + ") was out for repair — it returns to the pool, not to them, when it's back.")
                        .assetId(asset.getId())
                        .employeeUsername(employeeUsername)
                        .dueAt(LocalDate.now())
                        .build());
                continue;
            }
            if (asset.getStatus() != AssetStatus.ALLOCATED_IN_USE) continue;
            // Both branches move the asset to VACANT_DESK so a resubmitted offboarding
            // form (double-click, retry) doesn't loop back over the same device and
            // re-notify IT about something already handled — the status-changed
            // asset simply won't match ALLOCATED_IN_USE on a second pass.
            asset.setStatus(AssetStatus.VACANT_DESK);
            assetRepository.save(asset);
            if (decision == OffboardingDecision.RELEASE_TO_IT) {
                // Device handed over right now — IT gets an instant notification and
                // decides where to store it when they press "Receive device".
                notificationRepository.save(Notification.builder()
                        .type("DEVICE_RELEASE")
                        .message(who + " was offboarded — " + asset.getSerialNumber() + " (" + asset.getDeviceType() + ") released to IT. Receive and choose where to store it.")
                        .assetId(asset.getId())
                        .employeeUsername(employeeUsername)
                        .dueAt(LocalDate.now())
                        .build());
            } else {
                // Device stays at the vacant desk; the system reminds IT after 14 days.
                notificationRepository.save(Notification.builder()
                        .type("DESK_COLLECTION")
                        .message(who + "'s desk hold ends — collect " + asset.getSerialNumber() + " (" + asset.getDeviceType() + ") from the desk and choose where to store it.")
                        .assetId(asset.getId())
                        .employeeUsername(employeeUsername)
                        .dueAt(LocalDate.now().plusDays(14))
                        .build());
            }
        }
        return record;
    }
}
