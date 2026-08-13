-- V4 — company-issued phone number, distinct from the employee's personal
-- mobile and their emergency contact.
alter table users add column official_number varchar(255);
