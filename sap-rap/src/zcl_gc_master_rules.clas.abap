CLASS zcl_gc_master_rules DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    TYPES:
      BEGIN OF ty_error,
        field_name TYPE string,
        message    TYPE string,
      END OF ty_error,
      ty_errors TYPE STANDARD TABLE OF ty_error WITH EMPTY KEY.

    CLASS-METHODS check_customer
      IMPORTING customer_code TYPE string
                customer_name TYPE string
                customer_type TYPE string
                customer_email TYPE string
                status TYPE string
      RETURNING VALUE(errors) TYPE ty_errors.
    CLASS-METHODS check_product
      IMPORTING product_code TYPE string
                product_name TYPE string
                unit_price TYPE decfloat34
                currency_code TYPE string
                status TYPE string
      RETURNING VALUE(errors) TYPE ty_errors.
ENDCLASS.

CLASS zcl_gc_master_rules IMPLEMENTATION.
  METHOD check_customer.
    IF customer_code IS INITIAL OR strlen( customer_code ) > 30
       OR customer_code CN 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.
      APPEND VALUE #( field_name = 'CUSTOMERCODE'
        message = 'Customer code must contain 1 to 30 uppercase letters, digits or hyphens.' ) TO errors.
    ENDIF.
    IF condense( customer_name ) IS INITIAL.
      APPEND VALUE #( field_name = 'CUSTOMERNAME' message = 'Customer name is required.' ) TO errors.
    ENDIF.
    IF customer_type <> 'CUSTOMER' AND customer_type <> 'PROSPECT'
       AND customer_type <> 'PARTNER' AND customer_type <> 'SUPPLIER'.
      APPEND VALUE #( field_name = 'CUSTOMERTYPE' message = 'Invalid customer type.' ) TO errors.
    ENDIF.
    IF customer_email IS NOT INITIAL
       AND NOT matches( val = customer_email pcre = '^[^\s@]+@[^\s@]+\.[^\s@]+$' ).
      APPEND VALUE #( field_name = 'CUSTOMEREMAIL' message = 'Invalid email address.' ) TO errors.
    ENDIF.
    IF status <> 'ACTIVE' AND status <> 'INACTIVE'.
      APPEND VALUE #( field_name = 'STATUS' message = 'Status must be ACTIVE or INACTIVE.' ) TO errors.
    ENDIF.
  ENDMETHOD.

  METHOD check_product.
    IF product_code IS INITIAL OR strlen( product_code ) > 30
       OR product_code CN 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.
      APPEND VALUE #( field_name = 'PRODUCTCODE'
        message = 'Product code must contain 1 to 30 uppercase letters, digits or hyphens.' ) TO errors.
    ENDIF.
    IF condense( product_name ) IS INITIAL.
      APPEND VALUE #( field_name = 'PRODUCTNAME' message = 'Product name is required.' ) TO errors.
    ENDIF.
    IF unit_price < 0.
      APPEND VALUE #( field_name = 'UNITPRICE' message = 'Unit price cannot be negative.' ) TO errors.
    ENDIF.
    IF strlen( currency_code ) <> 3 OR currency_code CN 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.
      APPEND VALUE #( field_name = 'CURRENCYCODE' message = 'Currency must be a three-letter uppercase code.' ) TO errors.
    ENDIF.
    IF status <> 'ACTIVE' AND status <> 'INACTIVE'.
      APPEND VALUE #( field_name = 'STATUS' message = 'Status must be ACTIVE or INACTIVE.' ) TO errors.
    ENDIF.
  ENDMETHOD.
ENDCLASS.