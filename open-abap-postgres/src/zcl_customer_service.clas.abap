CLASS zcl_customer_service DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    TYPES price_type TYPE p LENGTH 8 DECIMALS 2.
    CLASS-METHODS normalize_name
      IMPORTING customer_name TYPE string
      RETURNING VALUE(normalized_name) TYPE string.
    CLASS-METHODS create_customer
      IMPORTING customer_id TYPE string customer_code TYPE string customer_name TYPE string
        customer_type TYPE string customer_email TYPE string phone TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS update_customer
      IMPORTING customer_id TYPE string customer_name TYPE string customer_type TYPE string
        customer_email TYPE string phone TYPE string status TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS delete_customer
      IMPORTING customer_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS create_product
      IMPORTING product_id TYPE string product_code TYPE string product_name TYPE string
        unit_price TYPE price_type currency_code TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS update_product
      IMPORTING product_id TYPE string product_name TYPE string
        unit_price TYPE price_type currency_code TYPE string status TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS delete_product
      IMPORTING product_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS create_order
      IMPORTING order_id TYPE string order_number TYPE string customer_id TYPE string
        product_id TYPE string line_id TYPE string quantity TYPE price_type
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS validate_order
      IMPORTING order_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS deliver_order
      IMPORTING order_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS cancel_order
      IMPORTING order_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS add_order_line
      IMPORTING order_id TYPE string line_id TYPE string product_id TYPE string quantity TYPE price_type
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS update_order_line
      IMPORTING order_id TYPE string line_id TYPE string product_id TYPE string quantity TYPE price_type
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS delete_order_line
      IMPORTING order_id TYPE string line_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS generate_invoice
      IMPORTING invoice_id TYPE string invoice_number TYPE string order_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS cancel_invoice
      IMPORTING invoice_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS record_payment
      IMPORTING payment_id TYPE string invoice_id TYPE string
        payment_amount TYPE price_type payment_method TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS reconcile_payment
      IMPORTING payment_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS cancel_payment
      IMPORTING payment_id TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS write_audit
      IMPORTING audit_id TYPE string module_name TYPE string action_name TYPE string
        actor_name TYPE string action_details TYPE string
      RETURNING VALUE(result) TYPE i.
ENDCLASS.

CLASS zcl_customer_service IMPLEMENTATION.
  METHOD normalize_name.
    normalized_name = condense( customer_name ).
  ENDMETHOD.

  METHOD create_customer.
    DATA customer TYPE zgc_customer.
    customer-customer_id = customer_id.
    customer-customer_code = customer_code.
    customer-customer_name = customer_name.
    CONDENSE customer-customer_name.
    customer-customer_type = customer_type.
    customer-customer_email = customer_email.
    customer-phone = phone.
    customer-status = 'ACTIVE'.
    INSERT zgc_customer FROM customer.
    result = sy-subrc.
  ENDMETHOD.

  METHOD update_customer.
    DATA normalized_name TYPE string.
    normalized_name = customer_name.
    CONDENSE normalized_name.
    UPDATE zgc_customer
      SET customer_name = @normalized_name,
          customer_type = @customer_type,
          customer_email = @customer_email,
          phone = @phone,
          status = @status
      WHERE customer_id = @customer_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD delete_customer.
    DELETE FROM zgc_customer WHERE customer_id = @customer_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD create_product.
    DATA product TYPE zgc_product.
    product-product_id = product_id.
    product-product_code = product_code.
    product-product_name = product_name.
    CONDENSE product-product_name.
    product-unit_price = unit_price.
    product-currency_code = currency_code.
    product-status = 'ACTIVE'.
    INSERT zgc_product FROM product.
    result = sy-subrc.
  ENDMETHOD.

  METHOD update_product.
    DATA normalized_name TYPE string.
    normalized_name = product_name.
    CONDENSE normalized_name.
    UPDATE zgc_product
      SET product_name = @normalized_name,
          unit_price = @unit_price,
          currency_code = @currency_code,
          status = @status
      WHERE product_id = @product_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD delete_product.
    DELETE FROM zgc_product WHERE product_id = @product_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD create_order.
    DATA product TYPE zgc_product.
    DATA sales_order TYPE zgc_sales_order.
    DATA order_line TYPE zgc_sales_order_line.
    SELECT SINGLE * FROM zgc_product INTO @product WHERE product_id = @product_id.
    IF sy-subrc <> 0.
      result = 4.
      RETURN.
    ENDIF.
    sales_order-sales_order_id = order_id.
    sales_order-order_number = order_number.
    sales_order-customer_id = customer_id.
    sales_order-order_date = sy-datum.
    sales_order-order_status = 'DRAFT'.
    sales_order-total_amount = product-unit_price * quantity.
    INSERT zgc_sales_order FROM sales_order.
    IF sy-subrc <> 0.
      result = sy-subrc.
      RETURN.
    ENDIF.
    order_line-sales_order_line_id = line_id.
    order_line-sales_order_id = order_id.
    order_line-product_id = product_id.
    order_line-quantity = quantity.
    order_line-unit_price = product-unit_price.
    order_line-line_amount = product-unit_price * quantity.
    INSERT zgc_sales_order_line FROM order_line.
    result = sy-subrc.
  ENDMETHOD.

  METHOD validate_order.
    UPDATE zgc_sales_order
      SET order_status = 'VALIDATED'
      WHERE sales_order_id = @order_id AND order_status = 'DRAFT'.
    result = sy-subrc.
  ENDMETHOD.

  METHOD deliver_order.
    UPDATE zgc_sales_order
      SET order_status = 'DELIVERED'
      WHERE sales_order_id = @order_id AND order_status = 'VALIDATED'.
    result = sy-subrc.
  ENDMETHOD.

  METHOD cancel_order.
    DATA sales_order TYPE zgc_sales_order.
    DATA invoice TYPE zgc_invoice.
    SELECT SINGLE * FROM zgc_sales_order INTO @sales_order WHERE sales_order_id = @order_id.
    IF sy-subrc <> 0 OR sales_order-order_status <> 'DRAFT'.
      result = 4.
      RETURN.
    ENDIF.
    SELECT SINGLE * FROM zgc_invoice INTO @invoice WHERE sales_order_id = @order_id.
    IF sy-subrc = 0.
      result = 4.
      RETURN.
    ENDIF.
    UPDATE zgc_sales_order SET order_status = 'CANCELLED' WHERE sales_order_id = @order_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD add_order_line.
    DATA sales_order TYPE zgc_sales_order.
    DATA product TYPE zgc_product.
    DATA order_line TYPE zgc_sales_order_line.
    DATA order_total TYPE price_type.
    SELECT SINGLE * FROM zgc_sales_order INTO @sales_order WHERE sales_order_id = @order_id.
    IF sy-subrc <> 0 OR sales_order-order_status <> 'DRAFT' OR quantity <= 0.
      result = 4.
      RETURN.
    ENDIF.
    SELECT SINGLE * FROM zgc_product INTO @product WHERE product_id = @product_id.
    IF sy-subrc <> 0 OR product-status <> 'ACTIVE'.
      result = 4.
      RETURN.
    ENDIF.
    order_line-sales_order_line_id = line_id.
    order_line-sales_order_id = order_id.
    order_line-product_id = product_id.
    order_line-quantity = quantity.
    order_line-unit_price = product-unit_price.
    order_line-line_amount = product-unit_price * quantity.
    INSERT zgc_sales_order_line FROM order_line.
    IF sy-subrc <> 0.
      result = sy-subrc.
      RETURN.
    ENDIF.
    SELECT SUM( line_amount ) FROM zgc_sales_order_line
      INTO @order_total WHERE sales_order_id = @order_id.
    UPDATE zgc_sales_order SET total_amount = @order_total WHERE sales_order_id = @order_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD update_order_line.
    DATA sales_order TYPE zgc_sales_order.
    DATA product TYPE zgc_product.
    DATA order_line TYPE zgc_sales_order_line.
    DATA order_total TYPE price_type.
    DATA line_amount TYPE price_type.
    SELECT SINGLE * FROM zgc_sales_order INTO @sales_order WHERE sales_order_id = @order_id.
    IF sy-subrc <> 0 OR sales_order-order_status <> 'DRAFT' OR quantity <= 0.
      result = 4.
      RETURN.
    ENDIF.
    SELECT SINGLE * FROM zgc_sales_order_line INTO @order_line
      WHERE sales_order_line_id = @line_id AND sales_order_id = @order_id.
    IF sy-subrc <> 0.
      result = 4.
      RETURN.
    ENDIF.
    SELECT SINGLE * FROM zgc_product INTO @product
      WHERE product_id = @product_id AND status = 'ACTIVE'.
    IF sy-subrc <> 0.
      result = 4.
      RETURN.
    ENDIF.
    line_amount = product-unit_price * quantity.
    DELETE FROM zgc_sales_order_line
      WHERE sales_order_line_id = @line_id AND sales_order_id = @order_id.
    IF sy-subrc <> 0.
      result = sy-subrc.
      RETURN.
    ENDIF.
    order_line-sales_order_line_id = line_id.
    order_line-sales_order_id = order_id.
    order_line-product_id = product_id.
    order_line-quantity = quantity.
    order_line-unit_price = product-unit_price.
    order_line-line_amount = line_amount.
    INSERT zgc_sales_order_line FROM order_line.
    IF sy-subrc <> 0.
      result = sy-subrc.
      RETURN.
    ENDIF.
    SELECT SUM( line_amount ) FROM zgc_sales_order_line
      INTO @order_total WHERE sales_order_id = @order_id.
    UPDATE zgc_sales_order SET total_amount = @order_total WHERE sales_order_id = @order_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD delete_order_line.
    DATA sales_order TYPE zgc_sales_order.
    DATA line_count TYPE i.
    DATA order_total TYPE price_type.
    SELECT SINGLE * FROM zgc_sales_order INTO @sales_order WHERE sales_order_id = @order_id.
    IF sy-subrc <> 0 OR sales_order-order_status <> 'DRAFT'.
      result = 4.
      RETURN.
    ENDIF.
    SELECT COUNT( * ) FROM zgc_sales_order_line
      INTO @line_count WHERE sales_order_id = @order_id.
    IF line_count <= 1.
      result = 4.
      RETURN.
    ENDIF.
    DELETE FROM zgc_sales_order_line
      WHERE sales_order_line_id = @line_id AND sales_order_id = @order_id.
    IF sy-subrc <> 0.
      result = sy-subrc.
      RETURN.
    ENDIF.
    SELECT SUM( line_amount ) FROM zgc_sales_order_line
      INTO @order_total WHERE sales_order_id = @order_id.
    UPDATE zgc_sales_order SET total_amount = @order_total WHERE sales_order_id = @order_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD generate_invoice.
    DATA sales_order TYPE zgc_sales_order.
    DATA existing_invoice TYPE zgc_invoice.
    DATA invoice TYPE zgc_invoice.
    SELECT SINGLE * FROM zgc_sales_order INTO @sales_order WHERE sales_order_id = @order_id.
    IF sy-subrc <> 0 OR sales_order-order_status <> 'VALIDATED'.
      result = 4.
      RETURN.
    ENDIF.
    SELECT SINGLE * FROM zgc_invoice INTO @existing_invoice WHERE sales_order_id = @order_id.
    IF sy-subrc = 0.
      result = 4.
      RETURN.
    ENDIF.
    invoice-invoice_id = invoice_id.
    invoice-invoice_number = invoice_number.
    invoice-sales_order_id = sales_order-sales_order_id.
    invoice-customer_id = sales_order-customer_id.
    invoice-invoice_date = sy-datum.
    invoice-invoice_status = 'OPEN'.
    invoice-total_amount = sales_order-total_amount.
    INSERT zgc_invoice FROM invoice.
    result = sy-subrc.
  ENDMETHOD.

  METHOD cancel_invoice.
    DATA invoice TYPE zgc_invoice.
    DATA payment TYPE zgc_payment.
    SELECT SINGLE * FROM zgc_invoice INTO @invoice WHERE invoice_id = @invoice_id.
    IF sy-subrc <> 0 OR invoice-invoice_status <> 'OPEN'.
      result = 4.
      RETURN.
    ENDIF.
    SELECT SINGLE * FROM zgc_payment INTO @payment WHERE invoice_id = @invoice_id.
    IF sy-subrc = 0.
      result = 4.
      RETURN.
    ENDIF.
    UPDATE zgc_invoice SET invoice_status = 'CANCELLED' WHERE invoice_id = @invoice_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD record_payment.
    DATA invoice TYPE zgc_invoice.
    DATA paid_amount TYPE price_type.
    DATA payment TYPE zgc_payment.
    SELECT SINGLE * FROM zgc_invoice INTO @invoice WHERE invoice_id = @invoice_id.
    IF sy-subrc <> 0 OR invoice-invoice_status <> 'OPEN' OR payment_amount <= 0.
      result = 4.
      RETURN.
    ENDIF.
    payment-payment_id = payment_id.
    payment-invoice_id = invoice_id.
    payment-payment_date = sy-datum.
    payment-payment_amount = payment_amount.
    payment-payment_method = payment_method.
    payment-payment_status = 'REGISTERED'.
    INSERT zgc_payment FROM payment.
    IF sy-subrc <> 0.
      result = sy-subrc.
      RETURN.
    ENDIF.
    SELECT SUM( payment_amount ) FROM zgc_payment
      INTO @paid_amount WHERE invoice_id = @invoice_id AND payment_status <> 'CANCELLED'.
    IF paid_amount >= invoice-total_amount.
      UPDATE zgc_invoice SET invoice_status = 'PAID' WHERE invoice_id = @invoice_id.
    ENDIF.
    result = 0.
  ENDMETHOD.

  METHOD reconcile_payment.
    UPDATE zgc_payment
      SET payment_status = 'RECONCILED'
      WHERE payment_id = @payment_id AND payment_status = 'REGISTERED'.
    result = sy-subrc.
  ENDMETHOD.

  METHOD cancel_payment.
    DATA payment TYPE zgc_payment.
    DATA invoice TYPE zgc_invoice.
    DATA paid_amount TYPE price_type.
    SELECT SINGLE * FROM zgc_payment INTO @payment WHERE payment_id = @payment_id.
    IF sy-subrc <> 0 OR payment-payment_status = 'CANCELLED'.
      result = 4.
      RETURN.
    ENDIF.
    SELECT SINGLE * FROM zgc_invoice INTO @invoice WHERE invoice_id = @payment-invoice_id.
    UPDATE zgc_payment SET payment_status = 'CANCELLED' WHERE payment_id = @payment_id.
    IF sy-subrc <> 0.
      result = sy-subrc.
      RETURN.
    ENDIF.
    SELECT SUM( payment_amount ) FROM zgc_payment
      INTO @paid_amount
      WHERE invoice_id = @payment-invoice_id AND payment_status <> 'CANCELLED'.
    IF paid_amount < invoice-total_amount.
      UPDATE zgc_invoice SET invoice_status = 'OPEN' WHERE invoice_id = @payment-invoice_id.
    ENDIF.
    result = 0.
  ENDMETHOD.

  METHOD write_audit.
    DATA audit_entry TYPE zgc_audit_log.
    audit_entry-audit_id = audit_id.
    audit_entry-module_name = module_name.
    audit_entry-action_name = action_name.
    audit_entry-actor_name = actor_name.
    audit_entry-action_details = action_details.
    audit_entry-created_date = sy-datum.
    INSERT zgc_audit_log FROM audit_entry.
    result = sy-subrc.
  ENDMETHOD.
ENDCLASS.