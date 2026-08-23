-- Phase 2 - reporting, soldes et audit applicatif
-- A executer apres sql/007_phase1_core.sql.

ALTER SESSION SET CURRENT_SCHEMA = APP_USER;

CREATE OR REPLACE VIEW v_invoice_balances AS
SELECT
    i.invoice_id,
    i.invoice_number,
    i.customer_id,
    c.customer_name,
    i.sales_order_id,
    i.invoice_date,
    i.invoice_status,
    i.total_amount,
    NVL(SUM(p.payment_amount), 0) AS paid_amount,
    i.total_amount - NVL(SUM(p.payment_amount), 0) AS remaining_amount
FROM invoices i
JOIN customers c ON c.customer_id = i.customer_id
LEFT JOIN payments p ON p.invoice_id = i.invoice_id
GROUP BY
    i.invoice_id,
    i.invoice_number,
    i.customer_id,
    c.customer_name,
    i.sales_order_id,
    i.invoice_date,
    i.invoice_status,
    i.total_amount;

CREATE OR REPLACE VIEW v_sales_pipeline AS
SELECT
    so.sales_order_id,
    so.order_number,
    so.order_date,
    so.order_status,
    c.customer_name,
    so.total_amount,
    CASE
        WHEN i.invoice_id IS NULL THEN 'NOT_INVOICED'
        WHEN i.invoice_status = 'PAID' THEN 'PAID'
        ELSE 'INVOICED_OPEN'
    END AS billing_status
FROM sales_orders so
JOIN customers c ON c.customer_id = so.customer_id
LEFT JOIN invoices i ON i.sales_order_id = so.sales_order_id;

CREATE OR REPLACE VIEW v_phase2_dashboard AS
SELECT
    (SELECT COUNT(*) FROM customers WHERE status = 'ACTIVE') AS active_customers,
    (SELECT COUNT(*) FROM products WHERE status = 'ACTIVE') AS active_products,
    (SELECT COUNT(*) FROM sales_orders WHERE order_status = 'VALIDATED') AS validated_orders,
    (SELECT NVL(SUM(total_amount), 0) FROM invoices) AS invoiced_amount,
    (SELECT NVL(SUM(payment_amount), 0) FROM payments) AS paid_amount,
    (SELECT NVL(SUM(remaining_amount), 0) FROM v_invoice_balances WHERE invoice_status <> 'PAID') AS outstanding_amount
FROM dual;

CREATE OR REPLACE PACKAGE pkg_reporting AS
    FUNCTION dashboard_json RETURN CLOB;
END pkg_reporting;
/

CREATE OR REPLACE PACKAGE BODY pkg_reporting AS
    FUNCTION dashboard_json RETURN CLOB IS
        l_payload CLOB;
    BEGIN
        SELECT JSON_OBJECT(
            'active_customers' VALUE active_customers,
            'active_products' VALUE active_products,
            'validated_orders' VALUE validated_orders,
            'invoiced_amount' VALUE invoiced_amount,
            'paid_amount' VALUE paid_amount,
            'outstanding_amount' VALUE outstanding_amount
            RETURNING CLOB
        )
        INTO l_payload
        FROM v_phase2_dashboard;

        RETURN l_payload;
    END dashboard_json;
END pkg_reporting;
/

CREATE OR REPLACE TRIGGER trg_audit_customers
AFTER INSERT OR UPDATE ON customers
FOR EACH ROW
DECLARE
    l_action_name VARCHAR2(100);
BEGIN
    IF INSERTING THEN
        l_action_name := 'CREATE';
    ELSE
        l_action_name := 'UPDATE';
    END IF;

    INSERT INTO audit_log(module_name, action_name, actor_name, action_details)
    VALUES (
        'CUSTOMER',
        l_action_name,
        SYS_CONTEXT('USERENV', 'SESSION_USER'),
        'customer_id=' || :NEW.customer_id || '; customer_code=' || :NEW.customer_code
    );
END;
/

CREATE OR REPLACE TRIGGER trg_audit_sales_orders
AFTER INSERT OR UPDATE ON sales_orders
FOR EACH ROW
DECLARE
    l_action_name VARCHAR2(100);
BEGIN
    IF INSERTING THEN
        l_action_name := 'CREATE';
    ELSE
        l_action_name := 'UPDATE';
    END IF;

    INSERT INTO audit_log(module_name, action_name, actor_name, action_details)
    VALUES (
        'ORDER',
        l_action_name,
        SYS_CONTEXT('USERENV', 'SESSION_USER'),
        'sales_order_id=' || :NEW.sales_order_id || '; order_number=' || :NEW.order_number || '; status=' || :NEW.order_status
    );
END;
/

CREATE OR REPLACE TRIGGER trg_audit_invoices
AFTER INSERT OR UPDATE ON invoices
FOR EACH ROW
DECLARE
    l_action_name VARCHAR2(100);
BEGIN
    IF INSERTING THEN
        l_action_name := 'GENERATE';
    ELSE
        l_action_name := 'UPDATE';
    END IF;

    INSERT INTO audit_log(module_name, action_name, actor_name, action_details)
    VALUES (
        'INVOICE',
        l_action_name,
        SYS_CONTEXT('USERENV', 'SESSION_USER'),
        'invoice_id=' || :NEW.invoice_id || '; invoice_number=' || :NEW.invoice_number || '; status=' || :NEW.invoice_status
    );
END;
/

CREATE OR REPLACE TRIGGER trg_audit_payments
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    INSERT INTO audit_log(module_name, action_name, actor_name, action_details)
    VALUES (
        'PAYMENT',
        'REGISTER',
        SYS_CONTEXT('USERENV', 'SESSION_USER'),
        'payment_id=' || :NEW.payment_id || '; invoice_id=' || :NEW.invoice_id || '; amount=' || :NEW.payment_amount
    );
END;
/

PROMPT Phase 2 reporting and audit objects created
