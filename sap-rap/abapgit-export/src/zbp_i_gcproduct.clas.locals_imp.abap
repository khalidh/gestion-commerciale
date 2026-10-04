CLASS lhc_product DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS get_global_authorizations FOR GLOBAL AUTHORIZATION
      IMPORTING REQUEST requested_authorizations FOR Product RESULT result.
    METHODS setDefaults FOR DETERMINE ON MODIFY
      IMPORTING keys FOR Product~setDefaults.
    METHODS validateProduct FOR VALIDATE ON SAVE
      IMPORTING keys FOR Product~validateProduct.
ENDCLASS.

CLASS lhc_product IMPLEMENTATION.
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
    READ ENTITIES OF ZI_GCProduct IN LOCAL MODE
      ENTITY Product FIELDS ( CurrencyCode Status ) WITH CORRESPONDING #( keys )
      RESULT DATA(products).
    MODIFY ENTITIES OF ZI_GCProduct IN LOCAL MODE
      ENTITY Product UPDATE FIELDS ( CurrencyCode Status )
      WITH VALUE #( FOR product IN products (
        %tky = product-%tky
        CurrencyCode = COND #( WHEN product-CurrencyCode IS INITIAL THEN 'EUR' ELSE product-CurrencyCode )
        Status = COND #( WHEN product-Status IS INITIAL THEN 'ACTIVE' ELSE product-Status ) ) )
      REPORTED DATA(default_reported).
    reported = CORRESPONDING #( DEEP default_reported ).
  ENDMETHOD.

  METHOD validateProduct.
    READ ENTITIES OF ZI_GCProduct IN LOCAL MODE
      ENTITY Product ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(products) FAILED failed.
    LOOP AT products INTO DATA(product).
      APPEND VALUE #( %tky = product-%tky %state_area = 'PRODUCT_CHECK' ) TO reported-product.
      DATA(errors) = zcl_gc_master_rules=>check_product(
        product_code = CONV #( product-ProductCode )
        product_name = CONV #( product-ProductName )
        unit_price = CONV #( product-UnitPrice )
        currency_code = CONV #( product-CurrencyCode )
        status = CONV #( product-Status ) ).
      IF product-ProductCode IS NOT INITIAL.
        DATA(duplicate) = abap_false.
        LOOP AT products INTO DATA(other_product) WHERE ProductCode = product-ProductCode.
          IF other_product-ProductUUID <> product-ProductUUID.
            duplicate = abap_true.
          ENDIF.
        ENDLOOP.
        SELECT SINGLE FROM zgc_rap_prod FIELDS product_uuid
          WHERE product_code = @product-ProductCode AND product_uuid <> @product-ProductUUID
          INTO @DATA(existing_uuid).
        IF sy-subrc = 0 OR duplicate = abap_true.
          APPEND VALUE #( field_name = 'PRODUCTCODE' message = 'Product code is already used.' ) TO errors.
        ENDIF.
      ENDIF.
      IF errors IS NOT INITIAL.
        APPEND VALUE #( %tky = product-%tky ) TO failed-product.
      ENDIF.
      LOOP AT errors INTO DATA(error).
        APPEND VALUE #(
          %tky = product-%tky %state_area = 'PRODUCT_CHECK'
          %msg = new_message_with_text( severity = if_abap_behv_message=>severity-error text = error-message )
        ) TO reported-product ASSIGNING FIELD-SYMBOL(<report>).
        ASSIGN COMPONENT error-field_name OF STRUCTURE <report>-%element TO FIELD-SYMBOL(<element>).
        IF sy-subrc = 0.
          <element> = if_abap_behv=>mk-on.
        ENDIF.
      ENDLOOP.
    ENDLOOP.
  ENDMETHOD.
ENDCLASS.