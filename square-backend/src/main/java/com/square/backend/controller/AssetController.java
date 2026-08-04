package com.square.backend.controller;

import com.square.backend.model.Asset;
import com.square.backend.model.AssetCondition;
import com.square.backend.model.AssetStatus;
import com.square.backend.repository.AssetRepository;
import com.square.backend.web.Paging;
import com.square.backend.service.AssetService;
import com.square.backend.service.AuditService;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;


@RestController
@RequestMapping("/api/assets")
public class AssetController {

    @Autowired
    private AuditService audit;

    @Autowired
    private AssetRepository assetRepository;

    @Autowired
    private AssetService assetService;

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
    public Map<String, Object> getAsset(@PathVariable Long id) {
        return assetRepository.findById(id).map(this::toView).orElse(null);
    }

    // Device registration. With a userId it's the employee's "+ Add device";
    // without one it's the Superuser adding brand-new stock to the IT inventory.
    // The price lands in originalValue so it feeds the capitalized-value total.
    @PostMapping
    public ResponseEntity<Map<String, Object>> registerDevice(@RequestBody Map<String, Object> body) {
        Object rawUserId = body.get("userId");
        Object rawWarrantyExpiry = body.get("warrantyExpiry");
        Object rawPrice = body.get("originalValue");
        double price = 0;
        try { if (rawPrice != null) price = Double.parseDouble(rawPrice.toString()); } catch (NumberFormatException ignored) {}
        boolean toInventory = rawUserId == null;
        Asset asset = Asset.builder()
                .serialNumber(String.valueOf(body.get("serialNumber")))
                .deviceType(String.valueOf(body.get("deviceType")))
                .deviceKind(str(body.get("deviceKind")))
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
                .userId(rawUserId == null ? null : Long.valueOf(rawUserId.toString()))
                .originalValue(price)
                .usefulLifeYears(4)
                .build();
        Asset saved = assetRepository.save(asset);
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
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })
    @PutMapping("/{id}/assign")
    public ResponseEntity<Map<String, Object>> assignAsset(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            Object rawUserId = body.get("userId");
            Long userId = rawUserId == null ? null : Long.valueOf(rawUserId.toString());
            Asset updated = assetService.assign(id, userId);
            audit.record(AuditService.ASSET_ASSIGNED, updated.getSerialNumber(),
                    "Assigned " + updated.getDeviceType() + " to user id " + userId);
            return ResponseEntity.ok(toView(updated));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Issue a pool device as a temporary loaner (hardware-malfunction repair flow).
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/loan")
    public ResponseEntity<Map<String, Object>> loanAsset(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            Long userId = body.get("userId") == null ? null : Long.valueOf(body.get("userId").toString());
            return ResponseEntity.ok(toView(assetService.loan(id, userId)));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Send a faulty device to a repair shop (original shop if under warranty, trusted shop otherwise).
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/repair")
    public ResponseEntity<Map<String, Object>> sendToRepair(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(toView(assetService.sendToRepair(id, body.get("shop"))));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Warranty replacement received from the original shop: {"newSerial": "..."} (optional).
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/warranty-replace")
    public ResponseEntity<Map<String, Object>> warrantyReplace(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(toView(assetService.warrantyReplace(id, body.get("newSerial"))));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Device came back from the shop: {"fixed": true|false}.
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/repair-return")
    public ResponseEntity<Map<String, Object>> repairReturn(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            boolean fixed = Boolean.parseBoolean(String.valueOf(body.get("fixed")));
            return ResponseEntity.ok(toView(assetService.repairReturn(id, fixed)));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Technician requests issuing a new inventory device — waits for supervisor acceptance.
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/request-assign")
    public ResponseEntity<Map<String, Object>> requestAssign(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            Long userId = body.get("userId") == null ? null : Long.valueOf(body.get("userId").toString());
            return ResponseEntity.ok(toView(assetService.requestAssign(id, userId)));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // IT receives an offboarded device and stores it: {"userId":..., "storage":"IT Closet"}.
    @RequiresRole({ Roles.IT_TECH })
    @PutMapping("/{id}/receive")
    public ResponseEntity<Map<String, Object>> receiveDevice(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(toView(assetService.receive(id, body.get("storage"))));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // Supervisor accepts or rejects the pending assignment: {"approve": true|false}.
    @RequiresRole({ Roles.SUPERVISOR })
    @PutMapping("/{id}/approve-assign")
    public ResponseEntity<Map<String, Object>> approveAssign(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            boolean approve = Boolean.parseBoolean(String.valueOf(body.get("approve")));
            return ResponseEntity.ok(toView(assetService.approveAssign(id, approve)));
        } catch (RuntimeException e) {
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
        return m;
    }

    private String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }
}
