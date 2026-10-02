ALTER SESSION SET CURRENT_SCHEMA = CUSTOMER_APP;

CREATE OR REPLACE PACKAGE pkg_customer AS
    PROCEDURE create_customer(
        p_customer_code IN VARCHAR2,
        p_customer_name IN VARCHAR2,
        p_customer_type IN VARCHAR2 DEFAULT 'CUSTOMER',
        p_email IN VARCHAR2 DEFAULT NULL,
        p_phone IN VARCHAR2 DEFAULT NULL
    );

    PROCEDURE update_customer(
        p_customer_id IN NUMBER,
        p_customer_name IN VARCHAR2,
        p_email IN VARCHAR2 DEFAULT NULL,
        p_phone IN VARCHAR2 DEFAULT NULL,
        p_status IN VARCHAR2 DEFAULT 'ACTIVE'
    );
END pkg_customer;
/

CREATE OR REPLACE PACKAGE BODY pkg_customer AS
    PROCEDURE create_customer(
        p_customer_code IN VARCHAR2,
        p_customer_name IN VARCHAR2,
        p_customer_type IN VARCHAR2 DEFAULT 'CUSTOMER',
        p_email IN VARCHAR2 DEFAULT NULL,
        p_phone IN VARCHAR2 DEFAULT NULL
    ) IS
    BEGIN
        INSERT INTO customers(customer_code, customer_name, customer_type, email, phone)
        VALUES (p_customer_code, p_customer_name, p_customer_type, p_email, p_phone);
    END create_customer;

    PROCEDURE update_customer(
        p_customer_id IN NUMBER,
        p_customer_name IN VARCHAR2,
        p_email IN VARCHAR2 DEFAULT NULL,
        p_phone IN VARCHAR2 DEFAULT NULL,
        p_status IN VARCHAR2 DEFAULT 'ACTIVE'
    ) IS
    BEGIN
        UPDATE customers
        SET customer_name = p_customer_name,
            email = p_email,
            phone = p_phone,
            status = p_status
        WHERE customer_id = p_customer_id;
    END update_customer;
END pkg_customer;
/

CREATE OR REPLACE PACKAGE pkg_sales AS
    PROCEDURE create_order(
        p_order_number IN VARCHAR2,
        p_customer_id IN NUMBER,
        p_total_amount IN NUMBER DEFAULT 0
    );

    PROCEDURE add_order_line(
        p_sales_order_id IN NUMBER,
        p_product_id IN NUMBER,
        p_quantity IN NUMBER,
        p_unit_price IN NUMBER
    );

    PROCEDURE validate_order(p_sales_order_id IN NUMBER);
END pkg_sales;
/

CREATE OR REPLACE PACKAGE BODY pkg_sales AS
    PROCEDURE create_order(
        p_order_number IN VARCHAR2,
        p_customer_id IN NUMBER,
        p_total_amount IN NUMBER DEFAULT 0
    ) IS
    BEGIN
        INSERT INTO sales_orders(order_number, customer_id, total_amount, order_status)
        VALUES (p_order_number, p_customer_id, p_total_amount, 'DRAFT');
    END create_order;

    PROCEDURE add_order_line(
        p_sales_order_id IN NUMBER,
        p_product_id IN NUMBER,
        p_quantity IN NUMBER,
        p_unit_price IN NUMBER
    ) IS
    BEGIN
        INSERT INTO sales_order_lines(
            sales_order_id, product_id, quantity, unit_price, line_amount
        )
        VALUES (
            p_sales_order_id, p_product_id, p_quantity, p_unit_price, p_quantity * p_unit_price
        );

        UPDATE sales_orders
        SET total_amount = (
            SELECT NVL(SUM(line_amount), 0)
            FROM sales_order_lines
            WHERE sales_order_id = p_sales_order_id
        )
        WHERE sales_order_id = p_sales_order_id;
    END add_order_line;

    PROCEDURE validate_order(p_sales_order_id IN NUMBER) IS
    BEGIN
        UPDATE sales_orders
        SET order_status = 'VALIDATED'
        WHERE sales_order_id = p_sales_order_id;
    END validate_order;
END pkg_sales;
/

CREATE OR REPLACE PACKAGE pkg_invoice AS
    PROCEDURE generate_invoice(
        p_sales_order_id IN NUMBER,
        p_invoice_number IN VARCHAR2
    );
END pkg_invoice;
/

CREATE OR REPLACE PACKAGE BODY pkg_invoice AS
    PROCEDURE generate_invoice(
        p_sales_order_id IN NUMBER,
        p_invoice_number IN VARCHAR2
    ) IS
        l_existing_invoice_count NUMBER;
    BEGIN
        SELECT COUNT(*)
        INTO l_existing_invoice_count
        FROM invoices
        WHERE sales_order_id = p_sales_order_id;

        IF l_existing_invoice_count > 0 THEN
            RAISE_APPLICATION_ERROR(-20001, 'Une facture existe déjà pour cette commande.');
        END IF;

        INSERT INTO invoices(invoice_number, sales_order_id, customer_id, total_amount, invoice_status)
        SELECT p_invoice_number, so.sales_order_id, so.customer_id, so.total_amount, 'OPEN'
        FROM sales_orders so
        WHERE so.sales_order_id = p_sales_order_id
          AND so.order_status = 'VALIDATED';
    END generate_invoice;
END pkg_invoice;
/

CREATE OR REPLACE PACKAGE pkg_payment AS
    PROCEDURE record_payment(
        p_invoice_id IN NUMBER,
        p_payment_amount IN NUMBER,
        p_payment_method IN VARCHAR2 DEFAULT 'TRANSFER'
    );
END pkg_payment;
/

CREATE OR REPLACE PACKAGE BODY pkg_payment AS
    PROCEDURE record_payment(
        p_invoice_id IN NUMBER,
        p_payment_amount IN NUMBER,
        p_payment_method IN VARCHAR2 DEFAULT 'TRANSFER'
    ) IS
    BEGIN
        INSERT INTO payments(invoice_id, payment_amount, payment_method, payment_status)
        VALUES (p_invoice_id, p_payment_amount, p_payment_method, 'REGISTERED');

        UPDATE invoices i
        SET invoice_status = 'PAID'
        WHERE i.invoice_id = p_invoice_id
          AND i.total_amount <= (
              SELECT NVL(SUM(p.payment_amount), 0)
              FROM payments p
              WHERE p.invoice_id = p_invoice_id
          );
    END record_payment;
END pkg_payment;
/
