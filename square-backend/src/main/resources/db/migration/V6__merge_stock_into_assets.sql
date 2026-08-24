-- V6 — the standalone general-stock registry (stock_items/stock_history) was a
-- parallel system to assets; it's really the same thing (bulk stock IS an
-- asset, just without a single serial number). Fold it into assets/asset_history
-- so devices and bulk stock share one table, one history log, one tab.

ALTER TABLE assets ALTER COLUMN serial_number DROP NOT NULL;
ALTER TABLE assets ALTER COLUMN status DROP NOT NULL;

ALTER TABLE assets ADD COLUMN category varchar(16) check ((category in ('COMPUTER','LAPTOP','PRINTER','OTHER')));
ALTER TABLE assets ADD COLUMN quantity integer not null default 1;
ALTER TABLE assets ADD COLUMN stock_state varchar(16) check ((stock_state in ('USABLE','NOT_USABLE','SCRAP')));
ALTER TABLE assets ADD COLUMN stock_condition varchar(16) check ((stock_condition in ('NEW','USED')));
ALTER TABLE assets ADD COLUMN not_usable_reason varchar(500);
ALTER TABLE assets ADD COLUMN moved_to_not_usable_at date;

-- Temporary column to correlate old stock_items.id -> new assets.id while
-- migrating stock_history; dropped again at the end of this file.
ALTER TABLE assets ADD COLUMN legacy_stock_id bigint;

INSERT INTO assets (device_type, category, quantity, stock_state, stock_condition, storage_location,
                     purchase_date, scrap_reason, scrapped_at, not_usable_reason, moved_to_not_usable_at,
                     original_value, useful_life_years, is_loaner, legacy_stock_id)
SELECT name, category, quantity, state, condition, storage_location,
       registered_at, scrap_reason, scrapped_at, not_usable_reason, moved_to_not_usable_at,
       0, 4, false, id
FROM stock_items;

CREATE TABLE asset_history (
    id               bigserial primary key,
    asset_id         bigint       not null,
    action           varchar(50)  not null,
    reason           varchar(500),
    quantity_moved   integer,
    amount_used      varchar(255),
    days_used        integer,
    used_by_user_id  bigint,
    used_by_name     varchar(255),
    actor_username   varchar(255) not null,
    at               timestamp    not null
);
CREATE INDEX idx_asset_history_item ON asset_history (asset_id);

INSERT INTO asset_history (asset_id, action, reason, quantity_moved, amount_used, days_used,
                            used_by_user_id, used_by_name, actor_username, at)
SELECT a.id, h.action, h.reason, h.quantity_moved, h.amount_used, h.days_used,
       h.used_by_user_id, h.used_by_name, h.actor_username, h.at
FROM stock_history h
JOIN assets a ON a.legacy_stock_id = h.stock_item_id;

ALTER TABLE assets DROP COLUMN legacy_stock_id;

DROP TABLE stock_history;
DROP TABLE stock_items;

CREATE INDEX idx_asset_stock_state ON assets (stock_state);

-- Backfill asset/non-asset classification onto existing serialized devices
-- too, so the computer/laptop/printer/other rule applies everywhere, not just
-- to newly-registered stock.
UPDATE assets SET category = CASE
    WHEN device_kind = 'Desktop' THEN 'COMPUTER'
    WHEN device_kind = 'Laptop' THEN 'LAPTOP'
    WHEN device_kind = 'Printer' THEN 'PRINTER'
    WHEN device_type ILIKE '%desktop%' OR device_type ILIKE '%workstation%' OR device_type ILIKE '%server%' THEN 'COMPUTER'
    WHEN device_type ILIKE '%laptop%' THEN 'LAPTOP'
    WHEN device_type ILIKE '%printer%' THEN 'PRINTER'
    ELSE 'OTHER'
END
WHERE category IS NULL AND serial_number IS NOT NULL;
