-- V5 — general IT stock registry (bulk items, asset & non-asset, tracked by
-- quantity rather than one row per unit) plus its append-only history log.
create table stock_items (
    id                   bigserial primary key,
    name                 varchar(255) not null,
    category             varchar(50)  not null,
    condition            varchar(50)  not null,
    quantity             integer      not null,
    state                varchar(50)  not null,
    storage_location     varchar(255) not null,
    registered_at        date         not null,
    not_usable_reason    varchar(500),
    moved_to_not_usable_at date,
    scrap_reason         varchar(500),
    scrapped_at          date
);
create index idx_stock_state on stock_items (state);

create table stock_history (
    id               bigserial primary key,
    stock_item_id    bigint       not null,
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
create index idx_stock_history_item on stock_history (stock_item_id);
