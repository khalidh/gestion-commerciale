-- Phase 2 - donnees transactionnelles de demonstration
-- A executer apres les packages PL/SQL et les objets Phase 2.

ALTER SESSION SET CURRENT_SCHEMA = CUSTOMER_APP;

DECLARE
    l_customer_id customers.customer_id%TYPE;
    l_product_id products.product_id%TYPE;
    l_order_id sales_orders.sales_order_id%TYPE;
    l_invoice_id invoices.invoice_id%TYPE;
BEGIN
    SELECT customer_id INTO l_customer_id FROM customers WHERE customer_code = 'CUST-001';
    SELECT product_id INTO l_product_id FROM products WHERE product_code = 'PROD-001';

    SELECT COUNT(*) INTO l_order_id FROM sales_orders WHERE order_number = 'ORD-001';
    IF l_order_id = 0 THEN
        pkg_sales.create_order('ORD-001', l_customer_id);
        SELECT sales_order_id INTO l_order_id FROM sales_orders WHERE order_number = 'ORD-001';
        pkg_sales.add_order_line(l_order_id, l_product_id, 2, 1250);
        pkg_sales.validate_order(l_order_id);
    ELSE
        SELECT sales_order_id INTO l_order_id FROM sales_orders WHERE order_number = 'ORD-001';
    END IF;

    SELECT COUNT(*) INTO l_invoice_id FROM invoices WHERE invoice_number = 'INV-001';
    IF l_invoice_id = 0 THEN
        pkg_invoice.generate_invoice(l_order_id, 'INV-001');
        SELECT invoice_id INTO l_invoice_id FROM invoices WHERE invoice_number = 'INV-001';
        pkg_payment.record_payment(l_invoice_id, 2500, 'TRANSFER');
    END IF;
END;
/

DECLARE
    l_customer_id customers.customer_id%TYPE;
    l_product_id products.product_id%TYPE;
    l_order_id sales_orders.sales_order_id%TYPE;
BEGIN
    SELECT customer_id INTO l_customer_id FROM customers WHERE customer_code = 'CUST-002';
    SELECT product_id INTO l_product_id FROM products WHERE product_code = 'PROD-002';

    SELECT COUNT(*) INTO l_order_id FROM sales_orders WHERE order_number = 'ORD-002';
    IF l_order_id = 0 THEN
        pkg_sales.create_order('ORD-002', l_customer_id);
        SELECT sales_order_id INTO l_order_id FROM sales_orders WHERE order_number = 'ORD-002';
        pkg_sales.add_order_line(l_order_id, l_product_id, 5, 320);
    END IF;
END;
/

COMMIT;

PROMPT Phase 2 transaction seed data loaded
