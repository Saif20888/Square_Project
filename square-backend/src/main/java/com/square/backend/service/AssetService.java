package com.square.backend.service;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetStatus;
import com.square.backend.model.Notification;
import com.square.backend.repository.AssetRepository;
import com.square.backend.repository.NotificationRepository;
import com.square.backend.repository.UserRepository;
import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import com.square.backend.web.ApiExceptionHandler.ConflictException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
public class AssetService {

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    private Asset find(Long id) {
        return assetRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Asset not found with ID: " + id));
    }

    /** Guards a transition against the asset's current status — everything below is
     *  a state machine even though it was never enforced as one. */
    private void requireStatus(Asset asset, Set<AssetStatus> allowed, String action) {
        if (!allowed.contains(asset.getStatus())) {
            throw new ConflictException("Can't " + action + " — this asset is currently "
                    + asset.getStatus() + ".");
        }
    }

    /** A malformed or made-up userId used to be written straight to the asset with
     *  no existence check — invisible on any "My Devices" list, unrecoverable
     *  through the UI. The database itself now rejects it too (V3 foreign key),
     *  but that surfaces as a raw 500; this gives a clean 400 instead. */
    private void requireRealUser(Long userId) {
        if (userId != null && !userRepository.existsById(userId)) {
            throw new BadRequestException("No such user (id " + userId + ").");
        }
    }

    // Marks an asset decommissioned (Scrap Registry). Allowed from anywhere except
    // an asset that's already scrapped — otherwise a repeat call just re-dates and
    // re-audits the same decommission.
    public Asset scrap(Long id, String reason) {
        Asset asset = find(id);
        requireStatus(asset, EnumSet.complementOf(EnumSet.of(AssetStatus.SCRAPPED)), "scrap");
        asset.setStatus(AssetStatus.SCRAPPED);
        asset.setScrapReason(reason);
        asset.setScrappedAt(LocalDate.now());
        asset.setUserId(null);
        return assetRepository.save(asset);
    }

    // Assigns custody to a user, or (userId == null) returns the asset to the pool.
    // Doubles as "reassign" and "mark loaner returned". Blocked while the asset is
    // out for repair (nothing to hand over) or awaiting a separate approval.
    private static final Set<AssetStatus> ASSIGNABLE_FROM = EnumSet.of(
            AssetStatus.AVAILABLE_IN_POOL, AssetStatus.ALLOCATED_IN_USE, AssetStatus.VACANT_DESK);

    public Asset assign(Long id, Long userId) {
        Asset asset = find(id);
        requireStatus(asset, ASSIGNABLE_FROM, "assign");
        requireRealUser(userId);
        if (userId != null) {
            asset.setUserId(userId);
            asset.setStatus(AssetStatus.ALLOCATED_IN_USE);
        } else {
            asset.setUserId(null);
            asset.setStatus(AssetStatus.AVAILABLE_IN_POOL);
        }
        // Whether it lands on someone or back in the pool, this closes out
        // whatever loaner status it had — a direct reassignment (person A to
        // person B without a stop in the pool) used to leave loaner state
        // pointing at A stuck on the record after B took the device.
        asset.setLoaner(false);
        asset.setLoanerIssuedAt(null);
        return assetRepository.save(asset);
    }

    // Issues a pool device as a temporary loaner while the employee's own device is
    // repaired. Only makes sense from stock that isn't already spoken for.
    private static final Set<AssetStatus> LOANABLE_FROM = EnumSet.of(
            AssetStatus.AVAILABLE_IN_POOL, AssetStatus.VACANT_DESK);

    public Asset loan(Long id, Long userId) {
        Asset asset = find(id);
        requireStatus(asset, LOANABLE_FROM, "loan out");
        requireRealUser(userId);
        asset.setUserId(userId);
        asset.setStatus(AssetStatus.ALLOCATED_IN_USE);
        asset.setLoaner(true);
        asset.setLoanerIssuedAt(LocalDate.now());
        return assetRepository.save(asset);
    }

    // Sends a faulty device out for repair; userId keeps pointing at the owner so we
    // know who to return it to. Can't send something already at the shop, scrapped,
    // or mid-approval.
    private static final Set<AssetStatus> REPAIRABLE_FROM = EnumSet.of(
            AssetStatus.ALLOCATED_IN_USE, AssetStatus.AVAILABLE_IN_POOL, AssetStatus.VACANT_DESK);

    public Asset sendToRepair(Long id, String shop) {
        Asset asset = find(id);
        requireStatus(asset, REPAIRABLE_FROM, "send this to repair");
        asset.setStatus(AssetStatus.IN_REPAIR);
        asset.setRepairShop(shop);
        asset.setSentToRepairAt(LocalDate.now());
        return assetRepository.save(asset);
    }

    // Device came back from the repair shop: fixed -> back to its owner,
    // not fixed -> straight to the Scrap Registry. Only valid for a device that's
    // actually at a shop right now.
    public Asset repairReturn(Long id, boolean fixed) {
        Asset asset = find(id);
        requireStatus(asset, EnumSet.of(AssetStatus.IN_REPAIR), "return this from repair");
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
    }

    // A device under warranty came back from the original shop as a brand-new
    // replacement unit: same asset record, optionally a new serial number, a
    // fresh 1-year warranty, and straight back to its owner. Same precondition as
    // repairReturn — it has to have actually been sent out.
    public Asset warrantyReplace(Long id, String newSerial) {
        Asset asset = find(id);
        requireStatus(asset, EnumSet.of(AssetStatus.IN_REPAIR), "record a warranty replacement for");
        if (newSerial != null && !newSerial.trim().isEmpty()) {
            asset.setSerialNumber(newSerial.trim());
        }
        asset.setStatus(asset.getUserId() != null ? AssetStatus.ALLOCATED_IN_USE : AssetStatus.AVAILABLE_IN_POOL);
        asset.setWarrantyExpiry(LocalDate.now().plusDays(365));
        asset.setPurchaseDate(LocalDate.now());
        asset.setRepairShop(null);
        asset.setSentToRepairAt(null);
        return assetRepository.save(asset);
    }

    // IT receives a device back (offboarding release or desk collection), picks a
    // storage spot, and the device joins the loaner stock. Any pending notification
    // for the device is closed out. Valid only for a device that's actually been
    // handed back — not one already sitting in the pool, at a shop, or scrapped.
    private static final Set<AssetStatus> RECEIVABLE_FROM = EnumSet.of(
            AssetStatus.ALLOCATED_IN_USE, AssetStatus.VACANT_DESK);

    public Asset receive(Long id, String storage) {
        Asset asset = find(id);
        requireStatus(asset, RECEIVABLE_FROM, "receive");
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
    }

    // A technician wants to issue this (new) device to an employee; it sits in
    // UNDER_REVIEW until a supervisor accepts or rejects the assignment. Only a
    // free pool device can be put up for request — otherwise a second request
    // could silently steal a device someone already holds.
    public Asset requestAssign(Long id, Long userId) {
        Asset asset = find(id);
        requireStatus(asset, EnumSet.of(AssetStatus.AVAILABLE_IN_POOL), "request this assignment");
        requireRealUser(userId);
        asset.setStatus(AssetStatus.UNDER_REVIEW);
        asset.setPendingUserId(userId);
        return assetRepository.save(asset);
    }

    // Supervisor decision on a pending new-device assignment. Must actually have a
    // decision pending — otherwise a repeated/duplicate call (double-click, retry)
    // would silently re-pool a device that was already handed out.
    public Asset approveAssign(Long id, boolean approve) {
        Asset asset = find(id);
        requireStatus(asset, EnumSet.of(AssetStatus.UNDER_REVIEW), "decide this assignment");
        if (approve) {
            asset.setUserId(asset.getPendingUserId());
            asset.setStatus(AssetStatus.ALLOCATED_IN_USE);
            asset.setPoolCondition(null);
        } else {
            asset.setStatus(AssetStatus.AVAILABLE_IN_POOL);
        }
        asset.setPendingUserId(null);
        return assetRepository.save(asset);
    }
}

