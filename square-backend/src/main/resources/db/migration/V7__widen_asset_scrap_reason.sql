-- V7 — stock_items.scrap_reason allowed up to 500 chars; assets.scrap_reason
-- has been varchar(255) since V1. V6 copied stock rows into assets without
-- widening it first, so a stock item with a scrap reason over 255 chars
-- would truncate silently (Postgres) or fail outright depending on driver
-- settings. Widen it to match, for both migrated and future rows.
ALTER TABLE assets ALTER COLUMN scrap_reason TYPE varchar(500);
