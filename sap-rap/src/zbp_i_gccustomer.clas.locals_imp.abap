CLASS lhc_customer DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS get_global_authorizations FOR GLOBAL AUTHORIZATION
      IMPORTING REQUEST requested_authorizations FOR Customer RESULT result.
    METHODS setDefaults FOR DETERMINE ON MODIFY
      IMPORTING keys FOR Customer~setDefaults.
    METHODS validateCustomer FOR VALIDATE ON SAVE
      IMPORTING keys FOR Customer~validateCustomer.
ENDCLASS.

CLASS lhc_customer IMPLEMENTATION.
  METHOD get_global_authorizations.
    IF requested_authorizations-%create = if_abap_behv=>mk-on.
      AUTHORITY-CHECK OBJECT 'ZGC_MDATA' ID 'ACTVT' FIELD '01'.
      result-%create = COND #( WHEN sy-subrc = 0 THEN if_abap_behv=>auth-allowed ELSE if_abap_behv=>auth-unauthorized ).
    ENDIF.
    IF requested_authorizations-%update = if_abap_behv=>mk-on
       OR requested_authorizations-%action-Edit = if_abap_behv=>mk-on.
      AUTHORITY-CHECK OBJECT 'ZGC_MDATA' ID 'ACTVT' FIELD '02'.
      result-%update = COND #( WHEN sy-subrc = 0 THEN if_abap_behv=>auth-allowed ELSE if_abap_behv=>auth-unauthorized ).
      result-%action-Edit = result-%update.
    ENDIF.
    IF requested_authorizations-%delete = if_abap_behv=>mk-on.
      AUTHORITY-CHECK OBJECT 'ZGC_MDATA' ID 'ACTVT' FIELD '06'.
      result-%delete = COND #( WHEN sy-subrc = 0 THEN if_abap_behv=>auth-allowed ELSE if_abap_behv=>auth-unauthorized ).
    ENDIF.
  ENDMETHOD.

  METHOD setDefaults.
    READ ENTITIES OF ZI_GCCustomer IN LOCAL MODE
      ENTITY Customer FIELDS ( CustomerType Status ) WITH CORRESPONDING #( keys )
      RESULT DATA(customers).
    MODIFY ENTITIES OF ZI_GCCustomer IN LOCAL MODE
      ENTITY Customer UPDATE FIELDS ( CustomerType Status )
      WITH VALUE #( FOR customer IN customers (
        %tky = customer-%tky
        CustomerType = COND #( WHEN customer-CustomerType IS INITIAL THEN 'CUSTOMER' ELSE customer-CustomerType )
        Status = COND #( WHEN customer-Status IS INITIAL THEN 'ACTIVE' ELSE customer-Status ) ) )
      REPORTED DATA(default_reported).
    reported = CORRESPONDING #( DEEP default_reported ).
  ENDMETHOD.

  METHOD validateCustomer.
    READ ENTITIES OF ZI_GCCustomer IN LOCAL MODE
      ENTITY Customer ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(customers).
    LOOP AT customers INTO DATA(customer).
      APPEND VALUE #( %tky = customer-%tky %state_area = 'CUSTOMER_CHECK' ) TO reported-customer.
      DATA(errors) = zcl_gc_master_rules=>check_customer(
        customer_code = CONV #( customer-CustomerCode )
        customer_name = CONV #( customer-CustomerName )
        customer_type = CONV #( customer-CustomerType )
        customer_email = CONV #( customer-CustomerEmail )
        status = CONV #( customer-Status ) ).
      IF customer-CustomerCode IS NOT INITIAL.
        DATA(duplicate) = abap_false.
        LOOP AT customers INTO DATA(other_customer) WHERE CustomerCode = customer-CustomerCode.
          IF other_customer-CustomerUUID <> customer-CustomerUUID.
            duplicate = abap_true.
          ENDIF.
        ENDLOOP.
        SELECT SINGLE FROM zgc_rap_cust FIELDS customer_uuid
          WHERE customer_code = @customer-CustomerCode AND customer_uuid <> @customer-CustomerUUID
          INTO @DATA(existing_uuid).
        IF sy-subrc = 0 OR duplicate = abap_true.
          APPEND VALUE #( field_name = 'CUSTOMERCODE' message = 'Customer code is already used.' ) TO errors.
        ENDIF.
      ENDIF.
      IF errors IS NOT INITIAL.
        APPEND VALUE #( %tky = customer-%tky ) TO failed-customer.
      ENDIF.
      LOOP AT errors INTO DATA(error).
        APPEND VALUE #(
          %tky = customer-%tky %state_area = 'CUSTOMER_CHECK'
          %msg = new_message_with_text( severity = if_abap_behv_message=>severity-error text = error-message )
        ) TO reported-customer ASSIGNING FIELD-SYMBOL(<report>).
        ASSIGN COMPONENT error-field_name OF STRUCTURE <report>-%element TO FIELD-SYMBOL(<element>).
        IF sy-subrc = 0.
          <element> = if_abap_behv=>mk-on.
        ENDIF.
      ENDLOOP.
    ENDLOOP.
  ENDMETHOD.
ENDCLASS.