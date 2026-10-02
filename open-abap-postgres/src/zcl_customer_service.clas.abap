CLASS zcl_customer_service DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    CLASS-METHODS normalize_name
      IMPORTING customer_name TYPE string
      RETURNING VALUE(normalized_name) TYPE string.
    CLASS-METHODS create_customer
      IMPORTING customer_id TYPE string customer_name TYPE string customer_email TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS update_customer
      IMPORTING customer_id TYPE string customer_name TYPE string customer_email TYPE string
      RETURNING VALUE(result) TYPE i.
    CLASS-METHODS delete_customer
      IMPORTING customer_id TYPE string
      RETURNING VALUE(result) TYPE i.
ENDCLASS.

CLASS zcl_customer_service IMPLEMENTATION.
  METHOD normalize_name.
    normalized_name = condense( customer_name ).
  ENDMETHOD.

  METHOD create_customer.
    DATA customer TYPE zgc_customer.
    customer-customer_id = customer_id.
    customer-customer_name = customer_name.
    CONDENSE customer-customer_name.
    customer-customer_email = customer_email.
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
          customer_email = @customer_email
      WHERE customer_id = @customer_id.
    result = sy-subrc.
  ENDMETHOD.

  METHOD delete_customer.
    DELETE FROM zgc_customer WHERE customer_id = @customer_id.
    result = sy-subrc.
  ENDMETHOD.
ENDCLASS.