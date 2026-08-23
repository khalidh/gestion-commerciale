-- Données de départ pour l'application de gestion commerciale
-- À exécuter après les scripts de schéma et de packages

ALTER SESSION SET CURRENT_SCHEMA = APP_USER;

SET DEFINE OFF;

INSERT INTO customers (customer_code, customer_name, customer_type, email, phone, status)
SELECT 'CUST-001', 'Acme SA', 'CUSTOMER', 'contact@acme.fr', '+33 1 00 00 00 01', 'ACTIVE' FROM dual
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE customer_code = 'CUST-001');

INSERT INTO customers (customer_code, customer_name, customer_type, email, phone, status)
SELECT 'CUST-002', 'Globex', 'CUSTOMER', 'sales@globex.com', '+33 1 00 00 00 02', 'ACTIVE' FROM dual
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE customer_code = 'CUST-002');

INSERT INTO products (product_code, product_name, unit_price, currency_code, status)
SELECT 'PROD-001', 'Pack Premium', 1250, 'EUR', 'ACTIVE' FROM dual
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_code = 'PROD-001');

INSERT INTO products (product_code, product_name, unit_price, currency_code, status)
SELECT 'PROD-002', 'Abonnement Pro', 320, 'EUR', 'ACTIVE' FROM dual
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_code = 'PROD-002');

INSERT INTO products (product_code, product_name, unit_price, currency_code, status)
SELECT 'PROD-003', 'Formation Enterprise', 950, 'EUR', 'ACTIVE' FROM dual
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_code = 'PROD-003');

COMMIT;
