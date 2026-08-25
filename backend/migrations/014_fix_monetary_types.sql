-- Corregir tipos monetarios de REAL a NUMERIC(12,2) para evitar errores de redondeo

ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(12,2) USING price::numeric(12,2);
ALTER TABLE orders ALTER COLUMN total TYPE NUMERIC(12,2) USING total::numeric(12,2);
ALTER TABLE orders ALTER COLUMN subtotal TYPE NUMERIC(12,2) USING subtotal::numeric(12,2);
ALTER TABLE orders ALTER COLUMN shipping_cost TYPE NUMERIC(12,2) USING shipping_cost::numeric(12,2);
ALTER TABLE orders ALTER COLUMN coupon_discount TYPE NUMERIC(12,2) USING coupon_discount::numeric(12,2);
ALTER TABLE order_items ALTER COLUMN price TYPE NUMERIC(12,2) USING price::numeric(12,2);
ALTER TABLE sales ALTER COLUMN unit_price TYPE NUMERIC(12,2) USING unit_price::numeric(12,2);
ALTER TABLE sales ALTER COLUMN total TYPE NUMERIC(12,2) USING total::numeric(12,2);
ALTER TABLE payment_config ALTER COLUMN shipping_cost TYPE NUMERIC(12,2) USING shipping_cost::numeric(12,2);
ALTER TABLE payment_config ALTER COLUMN free_shipping_from TYPE NUMERIC(12,2) USING free_shipping_from::numeric(12,2);
ALTER TABLE payment_config ALTER COLUMN included_shipping_cost TYPE NUMERIC(12,2) USING included_shipping_cost::numeric(12,2);
ALTER TABLE payment_proofs ALTER COLUMN amount TYPE NUMERIC(12,2) USING amount::numeric(12,2);
ALTER TABLE coupons ALTER COLUMN value TYPE NUMERIC(12,2) USING value::numeric(12,2);
ALTER TABLE coupons ALTER COLUMN min_amount TYPE NUMERIC(12,2) USING min_amount::numeric(12,2);
