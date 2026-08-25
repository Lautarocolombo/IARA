-- Agregar foreign keys faltantes para integridad referencial

ALTER TABLE payment_proofs ADD CONSTRAINT fk_payment_proofs_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE receipts ADD CONSTRAINT fk_receipts_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE inventory_movements ADD CONSTRAINT fk_inventory_movements_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE inventory_alerts ADD CONSTRAINT fk_inventory_alerts_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE activity_log ADD CONSTRAINT fk_activity_log_related_order_id FOREIGN KEY (related_order_id) REFERENCES orders(id) ON DELETE SET NULL;
