CLASS ltc_master_rules DEFINITION FINAL FOR TESTING DURATION SHORT RISK LEVEL HARMLESS.
  PRIVATE SECTION.
    METHODS valid_customer FOR TESTING.
    METHODS invalid_customer FOR TESTING.
    METHODS invalid_email FOR TESTING.
    METHODS blank_name FOR TESTING.
    METHODS valid_product FOR TESTING.
    METHODS negative_price FOR TESTING.
    METHODS invalid_currency FOR TESTING.
ENDCLASS.

CLASS ltc_master_rules IMPLEMENTATION.
  METHOD valid_customer.
    DATA(errors) = zcl_gc_master_rules=>check_customer(
      customer_code = 'CUST-001' customer_name = 'Acme'
      customer_type = 'CUSTOMER' customer_email = 'contact@example.invalid' status = 'ACTIVE' ).
    cl_abap_unit_assert=>assert_initial( errors ).
  ENDMETHOD.

  METHOD invalid_customer.
    DATA(errors) = zcl_gc_master_rules=>check_customer(
      customer_code = 'invalid code' customer_name = 'Acme'
      customer_type = 'OTHER' customer_email = '' status = 'OTHER' ).
    cl_abap_unit_assert=>assert_equals( exp = 3 act = lines( errors ) ).
    cl_abap_unit_assert=>assert_true( xsdbool( line_exists( errors[ field_name = 'CUSTOMERCODE' ] ) ) ).
    cl_abap_unit_assert=>assert_true( xsdbool( line_exists( errors[ field_name = 'CUSTOMERTYPE' ] ) ) ).
    cl_abap_unit_assert=>assert_true( xsdbool( line_exists( errors[ field_name = 'STATUS' ] ) ) ).
  ENDMETHOD.

  METHOD invalid_email.
    DATA(errors) = zcl_gc_master_rules=>check_customer(
      customer_code = 'CUST-001' customer_name = 'Acme'
      customer_type = 'CUSTOMER' customer_email = 'not-an-email' status = 'ACTIVE' ).
    cl_abap_unit_assert=>assert_equals( exp = 1 act = lines( errors ) ).
    cl_abap_unit_assert=>assert_true( xsdbool( line_exists( errors[ field_name = 'CUSTOMEREMAIL' ] ) ) ).
  ENDMETHOD.

  METHOD blank_name.
    DATA(errors) = zcl_gc_master_rules=>check_customer(
      customer_code = 'CUST-001' customer_name = '   '
      customer_type = 'CUSTOMER' customer_email = '' status = 'ACTIVE' ).
    cl_abap_unit_assert=>assert_equals( exp = 1 act = lines( errors ) ).
    cl_abap_unit_assert=>assert_true( xsdbool( line_exists( errors[ field_name = 'CUSTOMERNAME' ] ) ) ).
  ENDMETHOD.

  METHOD valid_product.
    DATA(errors) = zcl_gc_master_rules=>check_product(
      product_code = 'PROD-001' product_name = 'Free sample'
      unit_price = 0 currency_code = 'EUR' status = 'ACTIVE' ).
    cl_abap_unit_assert=>assert_initial( errors ).
  ENDMETHOD.

  METHOD negative_price.
    DATA(errors) = zcl_gc_master_rules=>check_product(
      product_code = 'PROD-001' product_name = 'Sample'
      unit_price = -1 currency_code = 'EUR' status = 'ACTIVE' ).
    cl_abap_unit_assert=>assert_equals( exp = 1 act = lines( errors ) ).
    cl_abap_unit_assert=>assert_true( xsdbool( line_exists( errors[ field_name = 'UNITPRICE' ] ) ) ).
  ENDMETHOD.

  METHOD invalid_currency.
    DATA(errors) = zcl_gc_master_rules=>check_product(
      product_code = 'PROD-001' product_name = 'Sample'
      unit_price = 10 currency_code = 'eur' status = 'ACTIVE' ).
    cl_abap_unit_assert=>assert_equals( exp = 1 act = lines( errors ) ).
    cl_abap_unit_assert=>assert_true( xsdbool( line_exists( errors[ field_name = 'CURRENCYCODE' ] ) ) ).
  ENDMETHOD.
ENDCLASS.