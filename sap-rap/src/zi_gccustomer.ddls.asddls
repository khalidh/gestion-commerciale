@EndUserText.label: 'Gestion commerciale - Customer'
@AccessControl.authorizationCheck: #NOT_REQUIRED
define root view entity ZI_GCCustomer
  as select from zgc_rap_cust
{
  key customer_uuid as CustomerUUID,
      customer_code as CustomerCode,
      customer_name as CustomerName,
      customer_type as CustomerType,
      customer_email as CustomerEmail,
      phone as Phone,
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