-- Packages PL/SQL de base

ALTER SESSION SET CURRENT_SCHEMA = CUSTOMER_APP;

CREATE OR REPLACE PACKAGE pkg_sales AS
    PROCEDURE create_order(p_customer_id NUMBER, p_order_number VARCHAR2, p_total_amount NUMBER);
    PROCEDURE add_order_line(p_sales_order_id NUMBER, p_product_id NUMBER, p_quantity NUMBER, p_unit_price NUMBER);
END pkg_sales;
/

CREATE OR REPLACE PACKAGE BODY pkg_sales AS
    PROCEDURE create_order(p_customer_id NUMBER, p_order_number VARCHAR2, p_total_amount NUMBER) IS
    BEGIN
        INSERT INTO sales_orders(order_number, customer_id, total_amount)
        VALUES (p_order_number, p_customer_id, p_total_amount);
    END create_order;

    PROCEDURE add_order_line(p_sales_order_id NUMBER, p_product_id NUMBER, p_quantity NUMBER, p_unit_price NUMBER) IS
    BEGIN
        INSERT INTO sales_order_lines(sales_order_id, product_id, quantity, unit_price, line_amount)
        VALUES (p_sales_order_id, p_product_id, p_quantity, p_unit_price, p_quantity * p_unit_price);
    END add_order_line;
END pkg_sales;
/

CREATE OR REPLACE PACKAGE pkg_invoice AS
    PROCEDURE generate_invoice(p_sales_order_id NUMBER, p_invoice_number VARCHAR2);
END pkg_invoice;
/

CREATE OR REPLACE PACKAGE BODY pkg_invoice AS
    PROCEDURE generate_invoice(p_sales_order_id NUMBER, p_invoice_number VARCHAR2) IS
    BEGIN
        INSERT INTO invoices(invoice_number, sales_order_id, customer_id, total_amount)
        SELECT p_invoice_number, so.sales_order_id, so.customer_id, so.total_amount
        FROM sales_orders so
        WHERE so.sales_order_id = p_sales_order_id;
    END generate_invoice;
END pkg_invoice;
/
