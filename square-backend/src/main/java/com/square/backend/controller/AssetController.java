package com.square.backend.controller;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetCondition;
import com.square.backend.model.AssetStatus;
import com.square.backend.model.StockCategory;
import com.square.backend.model.StockCondition;
import com.square.backend.model.StockState;
import com.square.backend.repository.AssetHistoryRepository;
import com.square.backend.repository.AssetRepository;
import com.square.backend.web.Paging;
import com.square.backend.service.AssetService;
import com.square.backend.service.AuditService;
import com.square.backend.security.CurrentUser;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;


@RestController
@RequestMapping("/api/assets")
public class AssetController {

    @Autowired
    private AuditService audit;

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private AssetHistoryRepository historyRepository;

    @Autowired
    private AssetService assetService;

    /** Upper bound on a device's declared price — blocks an absurd/negative value
     *  from distorting the capitalized-value total the Admin dashboard shows. */
    private static final double MAX_ASSET_VALUE = 1_000_000;

    // Plain array by default; ?page=0&size=50 pages, totals in X-Total-* headers.
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllAssets(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page == null) {
            return Paging.all(assetRepository.findAll().stream().map(this::toView).collect(Collectors.toList()));
        }
        return Paging.page(assetRepository.findAll(Paging.request(page, size)).map(this::toView));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getAsset(@PathVariable Long id) {
        return assetRepository.findById(id).map(a -> ResponseEntity.ok(toView(a)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // Device registration. With a userId it's the employee's "+ Add device";
    // without one it's the Superuser adding brand-new stock to the IT inventory.
    // The price lands in originalValue so it feeds the capitalized-value total.
    @PostMapping
    public ResponseEntity<Map<String, Object>> registerDevice(@RequestBody Map<String, Object> body) {
        Object rawUserId = body.get("userId");
        boolean toInventory = rawUserId == null;
        Long targetUserId = parseUserId(rawUserId);
        // Adding brand-new stock to the pool is IT-only; assigning a device to a
        // person is either that person doing their own "+ Add device", or IT/a
        // Supervisor doing it on someone else's behalf (e.g. during onboarding).
        boolean itStaff = CurrentUser.hasRole(Roles.IT_TECH, Roles.SUPERVISOR);
        if (toInventory ? !itStaff : (!itStaff && !CurrentUser.isSelfOrAdmin(targetUserId))) {
            return ResponseEntity.status(403).body(Map.of("message", "You are not allowed to register this device."));
        }
        Object rawWarrantyExpiry = body.get("warrantyExpiry");
        Object rawPrice = body.get("originalValue");
        double price = 0;
        try { if (rawPrice != null) price = Double.parseDouble(rawPrice.toString()); } catch (NumberFormatException ignored) {}
        price = Math.min(MAX_ASSET_VALUE, Math.max(0, price));
        String deviceKind = str(body.get("deviceKind"));
        String deviceType = String.valueOf(body.get("deviceType"));
        Asset asset = Asset.builder()
                .serialNumber(String.valueOf(body.get("serialNumber")))
                .deviceType(deviceType)
                .deviceKind(deviceKind)
                .category(StockCategory.fromDeviceKind(deviceKind, deviceType))
                .prNumber(str(body.get("prNumber")))
                .assetCategory(str(body.get("assetCategory")))
                .assetNumber(str(body.get("assetNumber")))
                .supplierName(str(body.get("supplierName")))
                .department(str(body.get("department")))
                .ipAddress(str(body.get("ipAddress")))
                .specifications(String.valueOf(body.getOrDefault("specifications", "")))
                .status(toInventory ? AssetStatus.AVAILABLE_IN_POOL : AssetStatus.ALLOCATED_IN_USE)
                .poolCondition(toInventory ? AssetCondition.NEW : null)
                .purchaseDate(LocalDate.now())
                .warrantyExpiry(rawWarrantyExpiry == null ? LocalDate.now().plusDays(365) : LocalDate.parse(rawWarrantyExpiry.toString()))
                .userId(targetUserId)
                .originalValue(price)
                .usefulLifeYears(4)
                .build();
        Asset saved = assetRepository.save(asset);
        audit.record(AuditService.ASSET_REGISTERED, saved.getSerialNumber(),
                (toInventory ? "Added to inventory: " : "Registered for user id " + targetUserId + ": ") + saved.getDeviceType());
        return ResponseEntity.ok(toView(saved));
    }

    @RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })
    @PutMapping("/{id}/scrap")
    public ResponseEntity<Map<String, Object>> scrapAsset(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            Asset updated = assetService.scrap(id, body.get("reason"));
            audit.record(AuditService.ASSET_SCRAPPED, updated.getSerialNumber(),
                    "Scrapped " + updated.getDeviceType() + " — reason: " + body.get("reason"));
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })
    @PutMapping("/{id}/assign")
    public ResponseEntity<Map<String, Object>> assignAsset(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            Long userId = parseUserId(body.get("userId"));
            Asset updated = assetService.assign(id, userId);
            audit.record(AuditService.ASSET_ASSIGNED, updated.getSerialNumber(),
                    "Assigned " + updated.getDeviceType() + " to user id " + userId);
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Issue a pool device as a temporary loaner (hardware-malfunction repair flow).
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/loan")
    public ResponseEntity<Map<String, Object>> loanAsset(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            Long userId = parseUserId(body.get("userId"));
            Asset updated = assetService.loan(id, userId);
            audit.record(AuditService.ASSET_LOANED, updated.getSerialNumber(), "Issued as a loaner to user id " + userId);
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Send a faulty device to a repair shop (original shop if under warranty, trusted shop otherwise).
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/repair")
    public ResponseEntity<Map<String, Object>> sendToRepair(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            Asset updated = assetService.sendToRepair(id, body.get("shop"));
            audit.record(AuditService.ASSET_SENT_TO_REPAIR, updated.getSerialNumber(), "Sent to " + body.get("shop"));
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Warranty replacement received from the original shop: {"newSerial": "..."} (optional).
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/warranty-replace")
    public ResponseEntity<Map<String, Object>> warrantyReplace(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            Asset updated = assetService.warrantyReplace(id, body.get("newSerial"));
            audit.record(AuditService.ASSET_WARRANTY_REPLACED, updated.getSerialNumber(), "Received a warranty replacement");
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Device came back from the shop: {"fixed": true|false}.
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/repair-return")
    public ResponseEntity<Map<String, Object>> repairReturn(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            boolean fixed = Boolean.parseBoolean(String.valueOf(body.get("fixed")));
            Asset updated = assetService.repairReturn(id, fixed);
            audit.record(AuditService.ASSET_REPAIR_RETURNED, updated.getSerialNumber(),
                    fixed ? "Returned from repair, fixed" : "Returned from repair, not fixed — scrapped");
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Technician requests issuing a new inventory device — waits for supervisor acceptance.
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/request-assign")
    public ResponseEntity<Map<String, Object>> requestAssign(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            Long userId = parseUserId(body.get("userId"));
            Asset updated = assetService.requestAssign(id, userId);
            audit.record(AuditService.ASSET_ASSIGN_REQUESTED, updated.getSerialNumber(), "Requested for user id " + userId);
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // IT receives an offboarded device and stores it: {"userId":..., "storage":"IT Closet"}.
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/receive")
    public ResponseEntity<Map<String, Object>> receiveDevice(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            Asset updated = assetService.receive(id, body.get("storage"));
            audit.record(AuditService.ASSET_RECEIVED, updated.getSerialNumber(), "Received into storage: " + body.get("storage"));
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Supervisor accepts or rejects the pending assignment: {"approve": true|false}.
    @RequiresRole({ Roles.SUPERVISOR })
    @PutMapping("/{id}/approve-assign")
    public ResponseEntity<Map<String, Object>> approveAssign(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            boolean approve = Boolean.parseBoolean(String.valueOf(body.get("approve")));
            Asset updated = assetService.approveAssign(id, approve);
            audit.record(AuditService.ASSET_ASSIGN_DECIDED, updated.getSerialNumber(), approve ? "Assignment approved" : "Assignment rejected");
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory(@PathVariable Long id) {
        return ResponseEntity.ok(historyRepository.findByAssetIdOrderByAtDesc(id).stream()
                .map(h -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", h.getId());
                    m.put("action", h.getAction());
                    m.put("reason", h.getReason());
                    m.put("quantityMoved", h.getQuantityMoved());
                    m.put("amountUsed", h.getAmountUsed());
                    m.put("daysUsed", h.getDaysUsed());
                    m.put("usedByUserId", h.getUsedByUserId());
                    m.put("usedByName", h.getUsedByName());
                    m.put("actorUsername", h.getActorUsername());
                    m.put("at", h.getAt());
                    return m;
                }).collect(Collectors.toList()));
    }

    // General IT stock — bulk items tracked by quantity. {"name","category","condition","quantity","storageLocation"}
    @RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })
    @PostMapping("/stock")
    public ResponseEntity<Map<String, Object>> registerStock(@RequestBody Map<String, Object> body) {
        StockCategory category = enumOf(StockCategory.class, body.get("category"), "category");
        StockCondition condition = body.get("condition") == null ? null : enumOf(StockCondition.class, body.get("condition"), "condition");
        int quantity = intOf(body.get("quantity"));
        Asset saved = assetService.registerStock(str(body.get("name")), category, condition, quantity, str(body.get("storageLocation")));
        audit.record(AuditService.STOCK_REGISTERED, saved.getDeviceType(),
                "Added " + saved.getQuantity() + " unit(s) — " + saved.getCategory() + " · " + saved.getStorageLocation());
        return ResponseEntity.ok(toView(saved));
    }

    // {"toState": "NOT_USABLE"|"SCRAP", "reason": "...", "quantity": optional}
    @RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })
    @PutMapping("/{id}/move")
    public ResponseEntity<Map<String, Object>> moveStock(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            StockState toState = enumOf(StockState.class, body.get("toState"), "toState");
            Integer quantity = body.get("quantity") == null ? null : intOf(body.get("quantity"));
            Asset updated = assetService.moveStock(id, toState, str(body.get("reason")), quantity);
            audit.record(AuditService.STOCK_STATE_CHANGED, updated.getDeviceType(),
                    "Moved to " + toState + " — " + updated.getQuantity() + " unit(s) — reason: " + body.get("reason"));
            return ResponseEntity.ok(toView(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // {"usedByUserId": optional, "usedByName": optional, "amountUsed": optional, "daysUsed": optional, "note": optional}
    @RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })
    @PostMapping("/{id}/usage")
    public ResponseEntity<Map<String, Object>> logUsage(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            Long usedByUserId = body.get("usedByUserId") == null ? null : longOf(body.get("usedByUserId"));
            Integer daysUsed = body.get("daysUsed") == null ? null : intOf(body.get("daysUsed"));
            Asset item = assetService.logStockUsage(id, usedByUserId, str(body.get("usedByName")), str(body.get("amountUsed")), daysUsed, str(body.get("note")));
            audit.record(AuditService.STOCK_USAGE_LOGGED, item.getDeviceType(),
                    "Usage logged — by " + (str(body.get("usedByName")) != null ? body.get("usedByName") : "user id " + usedByUserId));
            return ResponseEntity.ok(toView(item));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private Map<String, Object> toView(Asset a) {
        Map<String, Object> m = new LinkedHashMap<>();
        long days = a.getWarrantyExpiry() == null ? 0
                : ChronoUnit.DAYS.between(LocalDate.now(), a.getWarrantyExpiry());
        m.put("id", a.getId());
        m.put("serialNumber", a.getSerialNumber());
        m.put("deviceType", a.getDeviceType());
        m.put("deviceKind", a.getDeviceKind());
        m.put("prNumber", a.getPrNumber());
        m.put("assetCategory", a.getAssetCategory());
        m.put("assetNumber", a.getAssetNumber());
        m.put("supplierName", a.getSupplierName());
        m.put("department", a.getDepartment());
        m.put("ipAddress", a.getIpAddress());
        m.put("storageLocation", a.getStorageLocation());
        m.put("specifications", a.getSpecifications());
        m.put("status", a.getStatus());
        m.put("warrantyDaysRemaining", days);
        m.put("userId", a.getUserId());
        m.put("purchaseDate", a.getPurchaseDate());
        m.put("originalValue", a.getOriginalValue());
        m.put("usefulLifeYears", a.getUsefulLifeYears());
        m.put("poolCondition", a.getPoolCondition());
        m.put("isLoaner", a.isLoaner());
        m.put("loanerIssuedAt", a.getLoanerIssuedAt());
        m.put("repairShop", a.getRepairShop());
        m.put("sentToRepairAt", a.getSentToRepairAt());
        m.put("pendingUserId", a.getPendingUserId());
        m.put("scrapReason", a.getScrapReason());
        m.put("scrappedAt", a.getScrappedAt());
        m.put("category", a.getCategory());
        // Distinct from "assetCategory" above (the Asset/Non-Asset choice made at
        // registration, unrelated) — this is the computed ASSET/NON_ASSET class
        // derived from the stock category (computer/laptop/printer -> asset).
        m.put("stockClass", a.getCategory() == null ? null : (a.getCategory().isAsset() ? "ASSET" : "NON_ASSET"));
        m.put("quantity", a.getQuantity());
        m.put("stockState", a.getStockState());
        m.put("stockCondition", a.getStockCondition());
        m.put("notUsableReason", a.getNotUsableReason());
        m.put("movedToNotUsableAt", a.getMovedToNotUsableAt());
        return m;
    }

    private String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private int intOf(Object o) {
        try {
            return Integer.parseInt(String.valueOf(o).trim());
        } catch (Exception e) {
            throw new BadRequestException("Expected a whole number.");
        }
    }

    private Long longOf(Object o) {
        try {
            return Long.valueOf(String.valueOf(o).trim());
        } catch (Exception e) {
            throw new BadRequestException("Expected a whole number.");
        }
    }

    private <E extends Enum<E>> E enumOf(Class<E> type, Object o, String field) {
        if (o == null) throw new BadRequestException("Missing " + field + ".");
        try {
            return Enum.valueOf(type, o.toString().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid " + field + ": " + o);
        }
    }

    private Long parseUserId(Object raw) {
        if (raw == null) return null;
        try {
            return Long.valueOf(raw.toString());
        } catch (NumberFormatException e) {
            throw new BadRequestException("userId must be a number.");
        }
    }
}
