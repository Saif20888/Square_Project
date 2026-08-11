-- V3 — data-integrity constraints the baseline schema (V1) never had, plus
-- indexes on columns that turned out to be queried/filtered often, and two
-- columns nothing in the application ever reads or writes.
--
-- Foreign keys are all ON DELETE SET NULL rather than CASCADE: nothing in this
-- app deletes a user or an asset outright (employees are offboarded, devices
-- are scrapped — both are status changes, not row deletions), so this only
-- matters as a safety net, and losing a reference should never silently
-- delete unrelated history.

-- assets.user_id / pending_user_id previously accepted any bigint, including
-- one that matched no user at all (see AssetService.assign — a client-supplied
-- userId was written through with zero existence check before this release).
ALTER TABLE assets
    ADD CONSTRAINT fk_assets_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_assets_pending_user
        FOREIGN KEY (pending_user_id) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE tickets
    ADD CONSTRAINT fk_tickets_asset
        FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE SET NULL;

ALTER TABLE notifications
    ADD CONSTRAINT fk_notifications_asset
        FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE SET NULL;

-- users.role is the one string every @RequiresRole check pattern-matches
-- against; assets.status and offboarding_records.decision already get this
-- treatment in V1, role just never did.
ALTER TABLE users
    ADD CONSTRAINT chk_users_role
        CHECK (role IN ('EMPLOYEE', 'IT_TECH', 'SUPERVISOR', 'SYSTEM_ADMIN'));

-- Equally-hot columns that idx_asset_serial / idx_asset_status already treated
-- this way in V1 — these just didn't get it at the time.
CREATE INDEX idx_asset_user ON assets (user_id);
CREATE INDEX idx_notification_status ON notifications (status);
CREATE INDEX idx_notification_asset ON notifications (asset_id);
CREATE INDEX idx_offboarding_employee ON offboarding_records (employee_username);

-- Dead columns: mapped by the entity, never read or written by any controller
-- or service. Dropped here and unmapped from Asset.java in the same change.
ALTER TABLE assets
    DROP COLUMN invoice_url,
    DROP COLUMN location_id;
