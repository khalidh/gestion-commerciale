@EndUserText.label: 'Gestion commerciale - Product'
@AccessControl.authorizationCheck: #NOT_REQUIRED
define root view entity ZI_GCProduct
  as select from zgc_rap_prod
{
  key product_uuid as ProductUUID,
      product_code as ProductCode,
      product_name as ProductName,
      @Semantics.amount.currencyCode: 'CurrencyCode'
      unit_price as UnitPrice,
      @Semantics.currencyCode: true
      currency_code as CurrencyCode,
      status as Status,
      @Semantics.user.createdBy: true
      created_by as CreatedBy,
      @Semantics.systemDateTime.createdAt: true
      created_at as CreatedAt,
      @Semantics.user.lastChangedBy: true
      last_changed_by as LastChangedBy,
      @Semantics.systemDateTime.lastChangedAt: true
      last_changed_at as LastChangedAt,
      @Semantics.systemDateTime.localInstanceLastChangedAt: true
      local_last_changed_at as LocalLastChangedAt
}