-- Phase 3 - endpoints ORDS REST transactionnels
-- A executer avec APP_USER apres la Phase 2.

ALTER SESSION SET CURRENT_SCHEMA = APP_USER;

BEGIN
    ORDS.ENABLE_SCHEMA(
        p_enabled => TRUE,
        p_schema => 'APP_USER',
        p_url_mapping_type => 'BASE_PATH',
        p_url_mapping_pattern => 'gestion-commerciale',
        p_auto_rest_auth => FALSE
    );

    COMMIT;
END;
/

BEGIN
    ORDS.DELETE_MODULE(p_module_name => 'gestion-commerciale.phase3');
    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -20001 THEN
            RAISE;
        END IF;
END;
/

BEGIN
    ORDS.DEFINE_MODULE(
        p_module_name => 'gestion-commerciale.phase3',
        p_base_path => 'gestion-commerciale/api/',
        p_items_per_page => 50,
        p_status => 'PUBLISHED'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'index'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'index',
        p_method => 'GET',
        p_source_type => ORDS.source_type_query_one_row,
        p_source => q'[SELECT 'Gestion Commerciale Phase 3 API' AS name, '/dashboard,/customers,/products,/orders,/invoices,/payments,/audit' AS endpoints FROM dual]'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'dashboard'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'dashboard',
        p_method => 'GET',
        p_source_type => ORDS.source_type_query_one_row,
        p_source => 'SELECT active_customers, active_products, validated_orders, invoiced_amount, paid_amount, outstanding_amount FROM v_phase2_dashboard'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'customers'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'customers',
        p_method => 'GET',
        p_source_type => ORDS.source_type_query,
        p_source => 'SELECT customer_id, customer_code, customer_name, customer_type, email, phone, status FROM customers ORDER BY customer_name'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'customers',
        p_method => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'[
DECLARE
    l_next_number NUMBER;
    l_customer_code VARCHAR2(30);
BEGIN
    SELECT COUNT(*) + 1 INTO l_next_number FROM customers;
    l_customer_code := NVL(:customer_code, 'CUST-' || LPAD(l_next_number, 3, '0'));

    pkg_customer.create_customer(
        p_customer_code => l_customer_code,
        p_customer_name => :customer_name,
        p_customer_type => NVL(:customer_type, 'CUSTOMER'),
        p_email => :email,
        p_phone => :phone
    );
    :status_code := 201;
END;
]'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'products'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'products',
        p_method => 'GET',
        p_source_type => ORDS.source_type_query,
        p_source => 'SELECT product_id, product_code, product_name, unit_price, currency_code, status FROM products ORDER BY product_name'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'orders'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'orders',
        p_method => 'GET',
        p_source_type => ORDS.source_type_query,
        p_source => 'SELECT sales_order_id, order_number, customer_name, order_status, total_amount, billing_status FROM v_sales_pipeline ORDER BY sales_order_id'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'orders',
        p_method => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'[
DECLARE
    l_order_id sales_orders.sales_order_id%TYPE;
    l_next_number NUMBER;
    l_order_number sales_orders.order_number%TYPE;
    l_unit_price products.unit_price%TYPE;
BEGIN
    SELECT COUNT(*) + 1 INTO l_next_number FROM sales_orders;
    l_order_number := NVL(:order_number, 'ORD-' || LPAD(l_next_number, 3, '0'));
    SELECT unit_price INTO l_unit_price FROM products WHERE product_id = TO_NUMBER(:product_id);
    pkg_sales.create_order(l_order_number, TO_NUMBER(:customer_id));
    SELECT sales_order_id INTO l_order_id FROM sales_orders WHERE order_number = l_order_number;
    pkg_sales.add_order_line(l_order_id, TO_NUMBER(:product_id), TO_NUMBER(:quantity), l_unit_price);
    pkg_sales.validate_order(l_order_id);
    :status_code := 201;
END;
]'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'orders/:order_id/invoice'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'orders/:order_id/invoice',
        p_method => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'[
DECLARE
    l_next_number NUMBER;
    l_invoice_number invoices.invoice_number%TYPE;
BEGIN
    SELECT COUNT(*) + 1 INTO l_next_number FROM invoices;
    l_invoice_number := NVL(:invoice_number, 'INV-' || LPAD(l_next_number, 3, '0'));
    pkg_invoice.generate_invoice(TO_NUMBER(:order_id), l_invoice_number);
    :status_code := 201;
END;
]'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'invoices'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'invoices',
        p_method => 'GET',
        p_source_type => ORDS.source_type_query,
        p_source => 'SELECT invoice_id, invoice_number, sales_order_id, customer_name, total_amount, paid_amount, remaining_amount, invoice_status FROM v_invoice_balances ORDER BY invoice_id'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'payments'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'payments',
        p_method => 'GET',
        p_source_type => ORDS.source_type_query,
        p_source => 'SELECT payment_id, invoice_id, payment_date, payment_amount, payment_method FROM payments ORDER BY payment_id'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'payments',
        p_method => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'[
BEGIN
    pkg_payment.record_payment(TO_NUMBER(:invoice_id), TO_NUMBER(:amount), NVL(:payment_method, 'TRANSFER'));
    :status_code := 201;
END;
]'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'audit'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'audit',
        p_method => 'GET',
        p_source_type => ORDS.source_type_query,
        p_source => 'SELECT audit_log_id, module_name, action_name, actor_name, action_details, created_at FROM audit_log ORDER BY audit_log_id DESC FETCH FIRST 50 ROWS ONLY'
    );

    COMMIT;
END;
/

PROMPT Phase 3 ORDS REST module created
