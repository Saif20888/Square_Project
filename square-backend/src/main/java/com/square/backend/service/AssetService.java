package com.square.backend.service;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetStatus;
import com.square.backend.model.Notification;
import com.square.backend.repository.AssetRepository;
import com.square.backend.repository.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;

@Service
public class AssetService {

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    // Marks an asset decommissioned (Scrap Registry)
    public Asset scrap(Long id, String reason) {
        return assetRepository.findById(id).map(asset -> {
            asset.setStatus(AssetStatus.SCRAPPED);
            asset.setScrapReason(reason);
            asset.setScrappedAt(LocalDate.now());
            return assetRepository.save(asset);
        }).orElseThrow(() -> new RuntimeException("Asset not found with ID: " + id));
    }

    // Assigns custody to a user, or (userId == null) returns the asset to the pool.
    // Doubles as "reassign" and "mark loaner returned".
    public Asset assign(Long id, Long userId) {
        return assetRepository.findById(id).map(asset -> {
            if (userId != null) {
                asset.setUserId(userId);
                asset.setStatus(AssetStatus.ALLOCATED_IN_USE);
            } else {
                asset.setUserId(null);
                asset.setStatus(AssetStatus.AVAILABLE_IN_POOL);
                asset.setLoaner(false);
                asset.setLoanerIssuedAt(null);
            }
            return assetRepository.save(asset);
        }).orElseThrow(() -> new RuntimeException("Asset not found with ID: " + id));
    }

    // Issues a pool device as a temporary loaner while the employee's own device is repaired.
    public Asset loan(Long id, Long userId) {
        return assetRepository.findById(id).map(asset -> {
            asset.setUserId(userId);
            asset.setStatus(AssetStatus.ALLOCATED_IN_USE);
            asset.setLoaner(true);
            asset.setLoanerIssuedAt(LocalDate.now());
            return assetRepository.save(asset);
        }).orElseThrow(() -> new RuntimeException("Asset not found with ID: " + id));
    }

    // Sends a faulty device out for repair; userId keeps pointing at the owner so we
    // know who to return it to.
    public Asset sendToRepair(Long id, String shop) {
        return assetRepository.findById(id).map(asset -> {
            asset.setStatus(AssetStatus.IN_REPAIR);
            asset.setRepairShop(shop);
            asset.setSentToRepairAt(LocalDate.now());
            return assetRepository.save(asset);
        }).orElseThrow(() -> new RuntimeException("Asset not found with ID: " + id));
    }

    // Device came back from the repair shop: fixed -> back to its owner,
    // not fixed -> straight to the Scrap Registry.
    public Asset repairReturn(Long id, boolean fixed) {
        return assetRepository.findById(id).map(asset -> {
            if (fixed) {
                asset.setStatus(asset.getUserId() != null ? AssetStatus.ALLOCATED_IN_USE : AssetStatus.AVAILABLE_IN_POOL);
            } else {
                asset.setStatus(AssetStatus.SCRAPPED);
                asset.setScrapReason("Returned from " + (asset.getRepairShop() == null ? "repair" : asset.getRepairShop()) + " unrepaired — decommissioned");
                asset.setScrappedAt(LocalDate.now());
                asset.setUserId(null);
            }
            asset.setRepairShop(null);
            asset.setSentToRepairAt(null);
            return assetRepository.save(asset);
        }).orElseThrow(() -> new RuntimeException("Asset not found with ID: " + id));
    }

    // A device under warranty came back from the original shop as a brand-new
    // replacement unit: same asset record, optionally a new serial number, a
    // fresh 1-year warranty, and straight back to its owner.
    public Asset warrantyReplace(Long id, String newSerial) {
        return assetRepository.findById(id).map(asset -> {
            if (newSerial != null && !newSerial.trim().isEmpty()) {
                asset.setSerialNumber(newSerial.trim());
            }
            asset.setStatus(asset.getUserId() != null ? AssetStatus.ALLOCATED_IN_USE : AssetStatus.AVAILABLE_IN_POOL);
            asset.setWarrantyExpiry(LocalDate.now().plusDays(365));
            asset.setPurchaseDate(LocalDate.now());
            asset.setRepairShop(null);
            asset.setSentToRepairAt(null);
            return assetRepository.save(asset);
        }).orElseThrow(() -> new RuntimeException("Asset not found with ID: " + id));
    }

    // IT receives a device back (offboarding release or desk collection), picks a
    // storage spot, and the device joins the loaner stock. Any pending notification
    // for the device is closed out.
    public Asset receive(Long id, String storage) {
        return assetRepository.findById(id).map(asset -> {
            asset.setUserId(null);
            asset.setStatus(AssetStatus.AVAILABLE_IN_POOL);
            asset.setStorageLocation(storage);
            asset.setLoaner(false);
            asset.setLoanerIssuedAt(null);
            Asset saved = assetRepository.save(asset);
            for (Notification n : notificationRepository.findByAssetIdAndStatus(id, "PENDING")) {
                n.setStatus("DONE");
                notificationRepository.save(n);
            }
            return saved;
        }).orElseThrow(() -> new RuntimeException("Asset not found with ID: " + id));
    }

    // A technician wants to issue this (new) device to an employee; it sits in
    // UNDER_REVIEW until a supervisor accepts or rejects the assignment.
    public Asset requestAssign(Long id, Long userId) {
        return assetRepository.findById(id).map(asset -> {
            asset.setStatus(AssetStatus.UNDER_REVIEW);
            asset.setPendingUserId(userId);
            return assetRepository.save(asset);
        }).orElseThrow(() -> new RuntimeException("Asset not found with ID: " + id));
    }

    // Supervisor decision on a pending new-device assignment.
    public Asset approveAssign(Long id, boolean approve) {
        return assetRepository.findById(id).map(asset -> {
            if (approve && asset.getPendingUserId() != null) {
                asset.setUserId(asset.getPendingUserId());
                asset.setStatus(AssetStatus.ALLOCATED_IN_USE);
                asset.setPoolCondition(null);
            } else {
                asset.setStatus(AssetStatus.AVAILABLE_IN_POOL);
            }
            asset.setPendingUserId(null);
            return assetRepository.save(asset);
        }).orElseThrow(() -> new RuntimeException("Asset not found with ID: " + id));
    }
}

