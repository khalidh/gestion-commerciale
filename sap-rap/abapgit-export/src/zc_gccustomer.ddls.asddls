@EndUserText.label: 'Clients'
@AccessControl.authorizationCheck: #NOT_REQUIRED
@Metadata.allowExtensions: true
@Search.searchable: true
@ObjectModel.semanticKey: [ 'CustomerCode' ]
define root view entity ZC_GCCustomer
  provider contract transactional_query
  as projection on ZI_GCCustomer
{
  key CustomerUUID,
      CustomerCode,
      @Search.defaultSearchElement: true
      CustomerName,
      CustomerType,
      CustomerEmail,
      Phone,
      Status,
      CreatedBy,
      CreatedAt,
      LastChangedBy,
      LastChangedAt,
      LocalLastChangedAt
}