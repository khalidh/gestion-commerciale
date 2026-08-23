-- Phase 1 - cœur fonctionnel de l'application de gestion commerciale
-- Ce script complète le schéma métier avec contraintes, index et vues de base.

ALTER SESSION SET CURRENT_SCHEMA = APP_USER;

ALTER TABLE customers ADD CONSTRAINT chk_customer_status CHECK (status IN ('ACTIVE','INACTIVE'));
ALTER TABLE products ADD CONSTRAINT chk_product_status CHECK (status IN ('ACTIVE','INACTIVE'));
ALTER TABLE sales_orders ADD CONSTRAINT chk_order_status CHECK (order_status IN ('DRAFT','VALIDATED','CANCELLED','DELIVERED'));
ALTER TABLE invoices ADD CONSTRAINT chk_invoice_status CHECK (invoice_status IN ('OPEN','PAID','CANCELLED'));
ALTER TABLE payments ADD CONSTRAINT chk_payment_status CHECK (payment_status IN ('REGISTERED','RECONCILED','CANCELLED'));

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_orders_status ON sales_orders(order_status);
CREATE INDEX idx_invoices_status ON invoices(invoice_status);

CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
    (SELECT COUNT(*) FROM customers) AS customer_count,
    (SELECT COUNT(*) FROM products) AS product_count,
    (SELECT COUNT(*) FROM sales_orders) AS order_count,
    (SELECT NVL(SUM(total_amount),0) FROM invoices WHERE invoice_status = 'PAID') AS paid_revenue;

CREATE OR REPLACE VIEW v_order_lines AS
SELECT
    sol.sales_order_id,
    sol.sales_order_line_id,
    sol.product_id,
    p.product_name,
    sol.quantity,
    sol.unit_price,
    sol.line_amount
FROM sales_order_lines sol
JOIN products p ON p.product_id = sol.product_id;

PROMPT Phase 1 core objects created
