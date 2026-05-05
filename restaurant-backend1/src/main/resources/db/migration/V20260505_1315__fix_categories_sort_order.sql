-- Backfill invalid category sort_order values and enforce deterministic default.
UPDATE categories
SET sort_order = 0
WHERE sort_order IS NULL;

ALTER TABLE categories
    MODIFY COLUMN sort_order INT NOT NULL DEFAULT 0;

