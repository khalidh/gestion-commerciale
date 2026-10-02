-- Phase 3 - endpoints ORDS REST transactionnels
-- A executer avec CUSTOMER_APP apres la Phase 2.
-- Le script sql/011_phase3_security_auth.sql doit etre applique avant ce script.

ALTER SESSION SET CURRENT_SCHEMA = CUSTOMER_APP;

BEGIN
    ORDS.ENABLE_SCHEMA(
        p_enabled => TRUE,
        p_schema => 'CUSTOMER_APP',
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
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,SALES_USER,FINANCE_USER,REPORT_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    :status_code := 200;
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn('{"name":"Gestion Commerciale Phase 3 API","endpoints":"/dashboard,/customers,/products,/orders,/orders/:order_id/invoice,/invoices,/payments,/audit,/auth/session"}');
END;
~'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'auth/session'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'auth/session',
        p_method => 'GET',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
    l_payload CLOB;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,SALES_USER,FINANCE_USER,REPORT_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT json_object(
        'client_code' VALUE client_code,
        'client_name' VALUE client_name,
        'role_code' VALUE role_code,
        'status' VALUE status,
        'expires_at' VALUE TO_CHAR(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS')
        RETURNING CLOB
    )
    INTO l_payload
    FROM app_api_clients
    WHERE api_key_hash = STANDARD_HASH(:X_API_KEY, 'SHA256')
      AND status = 'ACTIVE'
      AND (expires_at IS NULL OR expires_at >= SYSDATE);

    :status_code := 200;
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn(l_payload);
END;
~'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'dashboard'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'dashboard',
        p_method => 'GET',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
    l_payload CLOB;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,SALES_USER,FINANCE_USER,REPORT_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT json_object(
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

    :status_code := 200;
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn(l_payload);
END;
~'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'customers'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'customers',
        p_method => 'GET',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
    l_payload CLOB;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,SALES_USER,REPORT_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT NVL(
        json_arrayagg(
            json_object(
                'customer_id' VALUE customer_id,
                'customer_code' VALUE customer_code,
                'customer_name' VALUE customer_name,
                'customer_type' VALUE customer_type,
                'email' VALUE email,
                'phone' VALUE phone,
                'status' VALUE status
                RETURNING CLOB
            )
            RETURNING CLOB
        ),
        TO_CLOB('[]')
    )
    INTO l_payload
    FROM (
        SELECT customer_id, customer_code, customer_name, customer_type, email, phone, status
        FROM customers
        ORDER BY customer_name
    );

    :status_code := 200;
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn(l_payload);
END;
~'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'customers',
        p_method => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_next_number NUMBER;
    l_customer_code VARCHAR2(30);
    l_access_status NUMBER;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,SALES_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

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
~'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'products'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'products',
        p_method => 'GET',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
    l_payload CLOB;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,SALES_USER,REPORT_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT NVL(
        json_arrayagg(
            json_object(
                'product_id' VALUE product_id,
                'product_code' VALUE product_code,
                'product_name' VALUE product_name,
                'unit_price' VALUE unit_price,
                'currency_code' VALUE currency_code,
                'status' VALUE status
                RETURNING CLOB
            )
            RETURNING CLOB
        ),
        TO_CLOB('[]')
    )
    INTO l_payload
    FROM (
        SELECT product_id, product_code, product_name, unit_price, currency_code, status
        FROM products
        ORDER BY product_name
    );

    :status_code := 200;
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn(l_payload);
END;
~'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'orders'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'orders',
        p_method => 'GET',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
    l_payload CLOB;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,SALES_USER,REPORT_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT NVL(
        json_arrayagg(
            json_object(
                'sales_order_id' VALUE sales_order_id,
                'order_number' VALUE order_number,
                'customer_name' VALUE customer_name,
                'order_status' VALUE order_status,
                'total_amount' VALUE total_amount,
                'billing_status' VALUE billing_status
                RETURNING CLOB
            )
            RETURNING CLOB
        ),
        TO_CLOB('[]')
    )
    INTO l_payload
    FROM (
        SELECT sales_order_id, order_number, customer_name, order_status, total_amount, billing_status
        FROM v_sales_pipeline
        ORDER BY sales_order_id
    );

    :status_code := 200;
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn(l_payload);
END;
~'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'orders',
        p_method => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_order_id sales_orders.sales_order_id%TYPE;
    l_next_number NUMBER;
    l_order_number sales_orders.order_number%TYPE;
    l_unit_price products.unit_price%TYPE;
    l_access_status NUMBER;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,SALES_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT COUNT(*) + 1 INTO l_next_number FROM sales_orders;
    l_order_number := NVL(:order_number, 'ORD-' || LPAD(l_next_number, 3, '0'));
    SELECT unit_price INTO l_unit_price FROM products WHERE product_id = TO_NUMBER(:product_id);
    pkg_sales.create_order(l_order_number, TO_NUMBER(:customer_id));
    SELECT sales_order_id INTO l_order_id FROM sales_orders WHERE order_number = l_order_number;
    pkg_sales.add_order_line(l_order_id, TO_NUMBER(:product_id), TO_NUMBER(:quantity), l_unit_price);
    pkg_sales.validate_order(l_order_id);
    :status_code := 201;
END;
~'
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
        p_source => q'~
DECLARE
    l_next_number NUMBER;
    l_invoice_number invoices.invoice_number%TYPE;
    l_access_status NUMBER;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,SALES_USER,FINANCE_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT COUNT(*) + 1 INTO l_next_number FROM invoices;
    l_invoice_number := NVL(:invoice_number, 'INV-' || LPAD(l_next_number, 3, '0'));
    pkg_invoice.generate_invoice(TO_NUMBER(:order_id), l_invoice_number);
    :status_code := 201;
END;
~'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'invoices'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'invoices',
        p_method => 'GET',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
    l_payload CLOB;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,FINANCE_USER,REPORT_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT NVL(
        json_arrayagg(
            json_object(
                'invoice_id' VALUE invoice_id,
                'invoice_number' VALUE invoice_number,
                'sales_order_id' VALUE sales_order_id,
                'customer_name' VALUE customer_name,
                'total_amount' VALUE total_amount,
                'paid_amount' VALUE paid_amount,
                'remaining_amount' VALUE remaining_amount,
                'invoice_status' VALUE invoice_status
                RETURNING CLOB
            )
            RETURNING CLOB
        ),
        TO_CLOB('[]')
    )
    INTO l_payload
    FROM (
        SELECT invoice_id, invoice_number, sales_order_id, customer_name, total_amount, paid_amount, remaining_amount, invoice_status
        FROM v_invoice_balances
        ORDER BY invoice_id
    );

    :status_code := 200;
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn(l_payload);
END;
~'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'payments'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'payments',
        p_method => 'GET',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
    l_payload CLOB;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,FINANCE_USER,REPORT_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT NVL(
        json_arrayagg(
            json_object(
                'payment_id' VALUE payment_id,
                'invoice_id' VALUE invoice_id,
                'payment_date' VALUE TO_CHAR(payment_date, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'payment_amount' VALUE payment_amount,
                'payment_method' VALUE payment_method
                RETURNING CLOB
            )
            RETURNING CLOB
        ),
        TO_CLOB('[]')
    )
    INTO l_payload
    FROM (
        SELECT payment_id, invoice_id, payment_date, payment_amount, payment_method
        FROM payments
        ORDER BY payment_id
    );

    :status_code := 200;
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn(l_payload);
END;
~'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'payments',
        p_method => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,FINANCE_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    pkg_payment.record_payment(TO_NUMBER(:invoice_id), TO_NUMBER(:amount), NVL(:payment_method, 'TRANSFER'));
    :status_code := 201;
END;
~'
    );

    ORDS.DEFINE_TEMPLATE(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'audit'
    );
    ORDS.DEFINE_HANDLER(
        p_module_name => 'gestion-commerciale.phase3',
        p_pattern => 'audit',
        p_method => 'GET',
        p_source_type => ORDS.source_type_plsql,
        p_source => q'~
DECLARE
    l_access_status NUMBER;
    l_payload CLOB;
BEGIN
    l_access_status := pkg_security.get_access_status(:X_API_KEY, 'APP_ADMIN,REPORT_USER');
    IF l_access_status = 401 THEN
        :status_code := 401;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"UNAUTHORIZED","message":"API key missing or invalid"}');
        RETURN;
    ELSIF l_access_status = 403 THEN
        :status_code := 403;
        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.prn('{"code":"FORBIDDEN","message":"Insufficient role permissions"}');
        RETURN;
    END IF;

    SELECT NVL(
        json_arrayagg(
            json_object(
                'audit_log_id' VALUE audit_log_id,
                'module_name' VALUE module_name,
                'action_name' VALUE action_name,
                'actor_name' VALUE actor_name,
                'action_details' VALUE action_details,
                'created_at' VALUE TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS')
                RETURNING CLOB
            )
            RETURNING CLOB
        ),
        TO_CLOB('[]')
    )
    INTO l_payload
    FROM (
        SELECT audit_log_id, module_name, action_name, actor_name, action_details, created_at
        FROM audit_log
        ORDER BY audit_log_id DESC
        FETCH FIRST 50 ROWS ONLY
    );

    :status_code := 200;
    owa_util.mime_header('application/json', FALSE);
    owa_util.http_header_close;
    htp.prn(l_payload);
END;
~'
    );

    COMMIT;
END;
/

PROMPT Phase 3 ORDS REST module created
