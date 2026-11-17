ALTER TABLE need_items DROP CONSTRAINT IF EXISTS need_items_category_check;
UPDATE need_items SET category='feature-request' WHERE category='technical-integration';
ALTER TABLE need_items ADD CONSTRAINT need_items_category_check CHECK (category IN ('user-testing','validation','adoption','technical-review','security','product-feedback','integration','feature-request','infrastructure','distribution','unknown'));
