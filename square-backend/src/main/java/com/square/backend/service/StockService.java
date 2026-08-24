package com.square.backend.service;

import com.square.backend.model.*;
import com.square.backend.repository.StockHistoryRepository;
import com.square.backend.repository.StockItemRepository;
import com.square.backend.security.CurrentUser;
import com.square.backend.web.ApiExceptionHandler.BadRequestException;
import com.square.backend.web.ApiExceptionHandler.ConflictException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.NoSuchElementException;

@Service
public class StockService {

    public static final String DEFAULT_STORAGE = "IT Backup Support";

    @Autowired
    private StockItemRepository stockRepository;

    @Autowired
    private StockHistoryRepository historyRepository;

    private StockItem find(Long id) {
        return stockRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Stock item not found with ID: " + id));
    }

    private String actor() {
        var session = CurrentUser.session();
        return session == null ? "system" : session.username();
    }

    private void log(Long stockItemId, String action, String reason, Integer quantityMoved,
                      String amountUsed, Integer daysUsed, Long usedByUserId, String usedByName) {
        historyRepository.save(StockHistoryEntry.builder()
                .stockItemId(stockItemId).action(action).reason(reason).quantityMoved(quantityMoved)
                .amountUsed(amountUsed).daysUsed(daysUsed).usedByUserId(usedByUserId).usedByName(usedByName)
                .actorUsername(actor()).at(LocalDateTime.now()).build());
    }

    public StockItem register(String name, StockCategory category, StockCondition condition, int quantity, String storageLocation) {
        if (name == null || name.trim().isEmpty()) throw new BadRequestException("Give this stock item a name.");
        if (quantity < 1) throw new BadRequestException("Quantity must be at least 1.");
        StockItem item = StockItem.builder()
                .name(name.trim())
                .category(category)
                .condition(condition == null ? StockCondition.NEW : condition)
                .quantity(quantity)
                .state(StockState.USABLE)
                .storageLocation(storageLocation == null || storageLocation.trim().isEmpty() ? DEFAULT_STORAGE : storageLocation.trim())
                .registeredAt(LocalDate.now())
                .build();
        StockItem saved = stockRepository.save(item);
        log(saved.getId(), "REGISTERED", null, quantity, null, null, null, null);
        return saved;
    }

    // usable -> not usable, usable -> scrap, not usable -> scrap. Anything else
    // (including moving out of scrap) is rejected — scrap is a one-way terminal state.
    // Transactional: a partial move is a decrement + a new-row save + two history
    // inserts — a failure partway through must not leave quantity split in half.
    @Transactional
    public StockItem move(Long id, StockState toState, String reason, Integer quantity) {
        StockItem item = find(id);
        if (toState == StockState.USABLE) {
            throw new ConflictException("Stock can't be moved back to usable.");
        }
        boolean allowed = (item.getState() == StockState.USABLE && (toState == StockState.NOT_USABLE || toState == StockState.SCRAP))
                || (item.getState() == StockState.NOT_USABLE && toState == StockState.SCRAP);
        if (!allowed) {
            throw new ConflictException("Can't move this item from " + item.getState() + " to " + toState + ".");
        }
        if (reason == null || reason.trim().isEmpty()) {
            throw new BadRequestException("A reason is required.");
        }
        int moveQty = (quantity == null || quantity <= 0 || quantity >= item.getQuantity()) ? item.getQuantity() : quantity;
        String action = toState == StockState.SCRAP ? "MOVED_TO_SCRAP" : "MOVED_TO_NOT_USABLE";

        if (moveQty < item.getQuantity()) {
            // Partial move — split the moved quantity into its own row, leave the rest behind.
            item.setQuantity(item.getQuantity() - moveQty);
            stockRepository.save(item);
            StockItem split = StockItem.builder()
                    .name(item.getName()).category(item.getCategory()).condition(item.getCondition())
                    .quantity(moveQty).state(toState).storageLocation(item.getStorageLocation())
                    .registeredAt(item.getRegisteredAt())
                    .notUsableReason(toState == StockState.NOT_USABLE ? reason.trim() : null)
                    .movedToNotUsableAt(toState == StockState.NOT_USABLE ? LocalDate.now() : null)
                    .scrapReason(toState == StockState.SCRAP ? reason.trim() : null)
                    .scrappedAt(toState == StockState.SCRAP ? LocalDate.now() : null)
                    .build();
            StockItem savedSplit = stockRepository.save(split);
            log(item.getId(), "QUANTITY_SPLIT", "Split off " + moveQty + " unit(s) to a new " + toState + " record", moveQty, null, null, null, null);
            log(savedSplit.getId(), action, reason.trim(), moveQty, null, null, null, null);
            return savedSplit;
        }

        item.setState(toState);
        if (toState == StockState.NOT_USABLE) {
            item.setNotUsableReason(reason.trim());
            item.setMovedToNotUsableAt(LocalDate.now());
        } else {
            item.setScrapReason(reason.trim());
            item.setScrappedAt(LocalDate.now());
        }
        StockItem saved = stockRepository.save(item);
        log(saved.getId(), action, reason.trim(), moveQty, null, null, null, null);
        return saved;
    }

    // Pure log entry — records who used how much / for how long. Never changes
    // quantity or state; it's a read-only trail, not an inventory transaction.
    public StockItem logUsage(Long id, Long usedByUserId, String usedByName, String amountUsed, Integer daysUsed, String note) {
        StockItem item = find(id);
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
