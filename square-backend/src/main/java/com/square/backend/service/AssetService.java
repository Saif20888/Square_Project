package com.square.backend.service;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetCondition;
import com.square.backend.model.AssetHistoryEntry;
import com.square.backend.model.AssetStatus;
import com.square.backend.model.Notification;
import com.square.backend.model.StockCategory;
import com.square.backend.model.StockCondition;
import com.square.backend.model.StockState;
import com.square.backend.repository.AssetHistoryRepository;
import com.square.backend.repository.AssetRepository;
import com.square.backend.repository.NotificationRepository;
import com.square.backend.repository.UserRepository;
import com.square.backend.security.CurrentUser;
import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import com.square.backend.web.ApiExceptionHandler.ConflictException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
public class AssetService {

    public static final String DEFAULT_STOCK_STORAGE = "F11 Storage";

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AssetHistoryRepository historyRepository;

    private Asset find(Long id) {
        return assetRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Asset not found with ID: " + id));
    }

    /** Guards a transition against the asset's current status — everything below is
     *  a state machine even though it was never enforced as one. Bulk stock rows
     *  (no serial number) have no status at all, so this is checked first — without
     *  it, a stock item's id hitting one of these endpoints would fail with a
     *  confusing "currently null" message instead of a clear one. */
    private void requireStatus(Asset asset, Set<AssetStatus> allowed, String action) {
        if (asset.getSerialNumber() == null) {
            throw new ConflictException("Can't " + action + " — this is general stock, not a serialized device.");
        }
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
        // Brand-new pool stock hasn't had a chance to fail yet — only a repaired or
        // used pool device can be scrapped. Doesn't apply to devices out in the
        // field (no pool condition) — those get scrapped for real failures.
        if (asset.getStatus() == AssetStatus.AVAILABLE_IN_POOL && asset.getPoolCondition() == AssetCondition.NEW) {
            throw new ConflictException("Can't scrap a new pool device — only repaired or used devices can be scrapped.");
        }
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

    // ===================================================================
    // General IT stock — bulk items tracked by quantity (serialNumber and
    // status are left null; stockState governs the usable/not-usable/scrap
    // lifecycle instead of AssetStatus). Same table, same history log as the
    // serialized devices above — a bulk item is just an Asset with no serial.
    // ===================================================================

    private String actor() {
        var session = CurrentUser.session();
        return session == null ? "system" : session.username();
    }

    private void log(Long assetId, String action, String reason, Integer quantityMoved,
                      String amountUsed, Integer daysUsed, Long usedByUserId, String usedByName) {
        historyRepository.save(AssetHistoryEntry.builder()
                .assetId(assetId).action(action).reason(reason).quantityMoved(quantityMoved)
                .amountUsed(amountUsed).daysUsed(daysUsed).usedByUserId(usedByUserId).usedByName(usedByName)
                .actorUsername(actor()).at(LocalDateTime.now()).build());
    }

    public Asset registerStock(String name, StockCategory category, StockCondition condition, int quantity, String storageLocation) {
        if (name == null || name.trim().isEmpty()) throw new BadRequestException("Give this stock item a name.");
        if (quantity < 1) throw new BadRequestException("Quantity must be at least 1.");
        Asset item = Asset.builder()
                .deviceType(name.trim())
                .category(category)
                .quantity(quantity)
                .stockState(StockState.USABLE)
                .stockCondition(condition == null ? StockCondition.NEW : condition)
                .storageLocation(storageLocation == null || storageLocation.trim().isEmpty() ? DEFAULT_STOCK_STORAGE : storageLocation.trim())
                .purchaseDate(LocalDate.now())
                .usefulLifeYears(4)
                .build();
        Asset saved = assetRepository.save(item);
        log(saved.getId(), "REGISTERED", null, quantity, null, null, null, null);
        return saved;
    }

    // usable -> not usable, usable -> scrap, not usable -> scrap. Anything else
    // (including moving out of scrap) is rejected — scrap is a one-way terminal state.
    @Transactional
    public Asset moveStock(Long id, StockState toState, String reason, Integer quantity) {
        Asset item = find(id);
        if (item.getStockState() == null) {
            throw new ConflictException("Not a stock item — use the device workflow for serialized assets.");
        }
        if (toState == StockState.USABLE) {
            throw new ConflictException("Stock can't be moved back to usable.");
        }
        boolean allowed = (item.getStockState() == StockState.USABLE && (toState == StockState.NOT_USABLE || toState == StockState.SCRAP))
                || (item.getStockState() == StockState.NOT_USABLE && toState == StockState.SCRAP);
        if (!allowed) {
            throw new ConflictException("Can't move this item from " + item.getStockState() + " to " + toState + ".");
        }
        // Brand-new stock hasn't had a chance to fail yet — only used stock can be
        // marked not usable or scrapped.
        if (item.getStockCondition() == StockCondition.NEW) {
            throw new ConflictException("Can't move new stock to " + toState + " — only used stock can be marked not usable or scrapped.");
        }
        if (reason == null || reason.trim().isEmpty()) {
            throw new BadRequestException("A reason is required.");
        }
        int moveQty = (quantity == null || quantity <= 0 || quantity >= item.getQuantity()) ? item.getQuantity() : quantity;
        String action = toState == StockState.SCRAP ? "MOVED_TO_SCRAP" : "MOVED_TO_NOT_USABLE";

        if (moveQty < item.getQuantity()) {
            // Partial move — split the moved quantity into its own row, leave the rest behind.
            item.setQuantity(item.getQuantity() - moveQty);
            assetRepository.save(item);
            Asset split = Asset.builder()
                    .deviceType(item.getDeviceType()).category(item.getCategory()).stockCondition(item.getStockCondition())
                    .quantity(moveQty).stockState(toState).storageLocation(item.getStorageLocation())
                    .purchaseDate(item.getPurchaseDate()).usefulLifeYears(item.getUsefulLifeYears())
                    .notUsableReason(toState == StockState.NOT_USABLE ? reason.trim() : null)
                    .movedToNotUsableAt(toState == StockState.NOT_USABLE ? LocalDate.now() : null)
                    .scrapReason(toState == StockState.SCRAP ? reason.trim() : null)
                    .scrappedAt(toState == StockState.SCRAP ? LocalDate.now() : null)
                    .build();
            Asset savedSplit = assetRepository.save(split);
            log(item.getId(), "QUANTITY_SPLIT", "Split off " + moveQty + " unit(s) to a new " + toState + " record", moveQty, null, null, null, null);
            log(savedSplit.getId(), action, reason.trim(), moveQty, null, null, null, null);
            return savedSplit;
        }

        item.setStockState(toState);
        if (toState == StockState.NOT_USABLE) {
            item.setNotUsableReason(reason.trim());
            item.setMovedToNotUsableAt(LocalDate.now());
        } else {
            item.setScrapReason(reason.trim());
            item.setScrappedAt(LocalDate.now());
        }
        Asset saved = assetRepository.save(item);
        log(saved.getId(), action, reason.trim(), moveQty, null, null, null, null);
        return saved;
    }

    // Pure log entry — records who used how much / for how long. Never changes
    // quantity or state; it's a read-only trail, not an inventory transaction.
    public Asset logStockUsage(Long id, Long usedByUserId, String usedByName, String amountUsed, Integer daysUsed, String note) {
        Asset item = find(id);
        if (item.getStockState() == null) {
            throw new ConflictException("Not a stock item — use the device workflow for serialized assets.");
        }
        if ((usedByName == null || usedByName.trim().isEmpty()) && usedByUserId == null) {
            throw new BadRequestException("Say who used this item.");
        }
        if ((amountUsed == null || amountUsed.trim().isEmpty()) && daysUsed == null) {
            throw new BadRequestException("Give an amount/portion or a number of days used.");
        }
        log(item.getId(), "USAGE_LOGGED", note, null, amountUsed == null ? null : amountUsed.trim(), daysUsed, usedByUserId,
                usedByName == null ? null : usedByName.trim());
        return item;
    }
}

