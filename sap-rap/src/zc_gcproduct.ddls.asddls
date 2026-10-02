@EndUserText.label: 'Produits'
@AccessControl.authorizationCheck: #NOT_REQUIRED
@Metadata.allowExtensions: true
@Search.searchable: true
@ObjectModel.semanticKey: [ 'ProductCode' ]
define root view entity ZC_GCProduct
  provider contract transactional_query
  as projection on ZI_GCProduct
{
  key ProductUUID,
      ProductCode,
      @Search.defaultSearchElement: true
      ProductName,
      UnitPrice,
      CurrencyCode,
      Status,
      CreatedBy,
      CreatedAt,
      LastChangedBy,
      LastChangedAt,
      LocalLastChangedAt
}