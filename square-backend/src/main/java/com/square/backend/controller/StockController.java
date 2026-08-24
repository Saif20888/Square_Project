package com.square.backend.controller;

import com.square.backend.model.StockCategory;
import com.square.backend.model.StockCondition;
import com.square.backend.model.StockItem;
import com.square.backend.model.StockState;
import com.square.backend.repository.StockHistoryRepository;
import com.square.backend.repository.StockItemRepository;
import com.square.backend.service.AuditService;
import com.square.backend.service.StockService;
import com.square.backend.security.RequiresRole;
import com.square.backend.security.Roles;
import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/stock")
public class StockController {

    @Autowired
    private AuditService audit;

    @Autowired
    private StockItemRepository stockRepository;

    @Autowired
    private StockHistoryRepository historyRepository;

    @Autowired
    private StockService stockService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllStock() {
        return ResponseEntity.ok(stockRepository.findAll().stream().map(this::toView).collect(Collectors.toList()));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory(@PathVariable Long id) {
        return ResponseEntity.ok(historyRepository.findByStockItemIdOrderByAtDesc(id).stream()
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

    @RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })
    @PostMapping
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, Object> body) {
        StockCategory category = enumOf(StockCategory.class, body.get("category"), "category");
        StockCondition condition = body.get("condition") == null ? null : enumOf(StockCondition.class, body.get("condition"), "condition");
        int quantity = intOf(body.get("quantity"));
        StockItem saved = stockService.register(str(body.get("name")), category, condition, quantity, str(body.get("storageLocation")));
        audit.record(AuditService.STOCK_REGISTERED, saved.getName(),
                "Added " + saved.getQuantity() + " unit(s) — " + saved.getCategory() + " · " + saved.getStorageLocation());
        return ResponseEntity.ok(toView(saved));
    }

    // {"toState": "NOT_USABLE"|"SCRAP", "reason": "...", "quantity": optional}
    @RequiresRole({ Roles.IT_TECH, Roles.SUPERVISOR })
    @PutMapping("/{id}/move")
    public ResponseEntity<Map<String, Object>> move(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        try {
            StockState toState = enumOf(StockState.class, body.get("toState"), "toState");
            Integer quantity = body.get("quantity") == null ? null : intOf(body.get("quantity"));
            StockItem updated = stockService.move(id, toState, str(body.get("reason")), quantity);
            audit.record(AuditService.STOCK_STATE_CHANGED, updated.getName(),
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
            StockItem item = stockService.logUsage(id, usedByUserId, str(body.get("usedByName")), str(body.get("amountUsed")), daysUsed, str(body.get("note")));
            audit.record(AuditService.STOCK_USAGE_LOGGED, item.getName(),
                    "Usage logged — by " + (str(body.get("usedByName")) != null ? body.get("usedByName") : "user id " + usedByUserId));
            return ResponseEntity.ok(toView(item));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private Map<String, Object> toView(StockItem s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.getId());
        m.put("name", s.getName());
        m.put("category", s.getCategory());
        m.put("assetCategory", s.getCategory().isAsset() ? "ASSET" : "NON_ASSET");
        m.put("condition", s.getCondition());
        m.put("quantity", s.getQuantity());
        m.put("state", s.getState());
        m.put("storageLocation", s.getStorageLocation());
        m.put("registeredAt", s.getRegisteredAt());
        m.put("notUsableReason", s.getNotUsableReason());
        m.put("movedToNotUsableAt", s.getMovedToNotUsableAt());
        m.put("scrapReason", s.getScrapReason());
        m.put("scrappedAt", s.getScrappedAt());
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
}
