-- Blueprint ORDS REST for Oracle-based commercial application
-- This scaffold defines modules, templates and handlers conceptually for Oracle REST Data Services.

CREATE OR REPLACE PACKAGE pkg_api_sales AS
    FUNCTION get_customers RETURN SYS_REFCURSOR;
    FUNCTION get_orders RETURN SYS_REFCURSOR;
    FUNCTION get_invoices RETURN SYS_REFCURSOR;
END pkg_api_sales;
/

CREATE OR REPLACE PACKAGE BODY pkg_api_sales AS
    FUNCTION get_customers RETURN SYS_REFCURSOR IS
        l_cursor SYS_REFCURSOR;
    BEGIN
        OPEN l_cursor FOR
            SELECT customer_id, customer_code, customer_name, email, phone, status
            FROM customers
            ORDER BY customer_name;
        RETURN l_cursor;
    END get_customers;

    FUNCTION get_orders RETURN SYS_REFCURSOR IS
        l_cursor SYS_REFCURSOR;
    BEGIN
        OPEN l_cursor FOR
            SELECT sales_order_id, order_number, customer_id, order_status, total_amount
            FROM sales_orders
            ORDER BY sales_order_id DESC;
        RETURN l_cursor;
    END get_orders;

    FUNCTION get_invoices RETURN SYS_REFCURSOR IS
        l_cursor SYS_REFCURSOR;
    BEGIN
        OPEN l_cursor FOR
            SELECT invoice_id, invoice_number, customer_id, invoice_status, total_amount
            FROM invoices
            ORDER BY invoice_id DESC;
        RETURN l_cursor;
    END get_invoices;
END pkg_api_sales;
/

-- Suggested ORDS endpoints:
-- GET /sales/customers -> pkg_api_sales.get_customers
-- GET /sales/orders -> pkg_api_sales.get_orders
-- GET /sales/invoices -> pkg_api_sales.get_invoices
-- POST /sales/orders -> calls pkg_sales.create_order and pkg_sales.add_order_line
