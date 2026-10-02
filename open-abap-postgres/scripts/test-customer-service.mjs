import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresDatabaseClient } from '@abaplint/database-pg';
import { createCustomerService, ensurePostgresSchema } from '../src/customer-service.mjs';

process.loadEnvFile(new URL('../.env', import.meta.url));
const config = {
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT),
};
const pool = new Pool(config);
const database = new PostgresDatabaseClient(config);
const service = await createCustomerService(database);
const customerId = 'test-customer-openabap';
const orderId = randomUUID();
const lineId = randomUUID();
const extraLineId = randomUUID();
const invoiceId = randomUUID();
const firstPaymentId = randomUUID();
const secondPaymentId = randomUUID();
const thirdPaymentId = randomUUID();
const auditId = randomUUID();
const cancelledOrderId = randomUUID();
const cancelledInvoiceOrderId = randomUUID();
const cancelledInvoiceId = randomUUID();

try {
  await database.connect();
  await ensurePostgresSchema(pool, database, service.schema);

  await pool.query(
    'DELETE FROM zgc_customer WHERE rtrim(customer_id) = $1',
    [customerId],
  );
  const created = await service.create({
    customer_id: customerId,
    customer_code: 'CUST-TEST-001',
    customer_name: '  Test   Client  ',
    customer_type: 'CUSTOMER',
    customer_email: 'test@example.invalid',
    phone: '+1 555 0100',
    status: 'ACTIVE',
  });
  const afterCreate = await pool.query(
    'SELECT rtrim(customer_code) AS code, rtrim(customer_name) AS name, rtrim(customer_type) AS type, rtrim(phone) AS phone, rtrim(status) AS status FROM zgc_customer WHERE rtrim(customer_id) = $1',
    [customerId],
  );
  if (created !== 0 || afterCreate.rows[0]?.code !== 'CUST-TEST-001'
      || afterCreate.rows[0]?.name !== 'Test Client'
      || afterCreate.rows[0]?.type !== 'CUSTOMER'
      || afterCreate.rows[0]?.phone !== '+1 555 0100'
      || afterCreate.rows[0]?.status !== 'ACTIVE') {
    throw new Error(`La création ABAP a échoué (sy-subrc=${created}, client=${JSON.stringify(afterCreate.rows[0])}).`);
  }

  const updated = await service.update({
    customer_id: customerId,
    customer_name: 'Client Modifie',
    customer_type: 'PROSPECT',
    customer_email: 'updated@example.invalid',
    phone: '+1 555 0101',
    status: 'ACTIVE',
  });
  const afterUpdate = await pool.query(
    'SELECT rtrim(customer_name) AS name, rtrim(customer_type) AS type, rtrim(phone) AS phone, rtrim(status) AS status, rtrim(customer_email) AS email FROM zgc_customer WHERE rtrim(customer_id) = $1',
    [customerId],
  );
  if (updated !== 0 || afterUpdate.rows[0]?.name !== 'Client Modifie'
      || afterUpdate.rows[0]?.type !== 'PROSPECT'
      || afterUpdate.rows[0]?.phone !== '+1 555 0101'
      || afterUpdate.rows[0]?.status !== 'ACTIVE'
      || afterUpdate.rows[0]?.email !== 'updated@example.invalid') {
    throw new Error(`La modification ABAP du client a échoué (sy-subrc=${updated}, nom=${afterUpdate.rows[0]?.name}).`);
  }

  const deleted = await service.delete(customerId);
  if (deleted !== 0) {
    throw new Error('La suppression ABAP du client a échoué.');
  }

  const productId = 'test-product-openabap';
  await pool.query('DELETE FROM zgc_product WHERE rtrim(product_id) = $1', [productId]);
  const productCreated = await service.createProduct({
    product_id: productId,
    product_code: 'PROD-TEST-001',
    product_name: 'Support   Plus',
    unit_price: 125.5,
    currency_code: 'EUR',
  });
  const productAfterCreate = await pool.query(
    'SELECT rtrim(product_name) AS name, unit_price FROM zgc_product WHERE rtrim(product_id) = $1',
    [productId],
  );
  if (productCreated !== 0
      || productAfterCreate.rows[0]?.name !== 'Support Plus'
      || Number(productAfterCreate.rows[0]?.unit_price) !== 125.5) {
    throw new Error(`La création produit ABAP a échoué (sy-subrc=${productCreated}).`);
  }

  const productUpdated = await service.updateProduct({
    product_id: productId,
    product_name: 'Support Premium',
    unit_price: 149.9,
    currency_code: 'EUR',
    status: 'INACTIVE',
  });
  const productAfterUpdate = await pool.query(
    'SELECT rtrim(product_name) AS name, unit_price, rtrim(status) AS status FROM zgc_product WHERE rtrim(product_id) = $1',
    [productId],
  );
  if (productUpdated !== 0
      || productAfterUpdate.rows[0]?.name !== 'Support Premium'
      || Number(productAfterUpdate.rows[0]?.unit_price) !== 149.9) {
    throw new Error(`La modification produit ABAP a échoué (sy-subrc=${productUpdated}).`);
  }

  const productDeleted = await service.deleteProduct(productId);
  if (productDeleted !== 0) {
    throw new Error('La suppression produit ABAP a échoué.');
  }

  const customer = await pool.query(
    "SELECT rtrim(customer_id) AS id FROM zgc_customer WHERE rtrim(status) = 'ACTIVE' LIMIT 1",
  );
  const product = await pool.query(
    "SELECT rtrim(product_id) AS id, unit_price FROM zgc_product WHERE rtrim(status) = 'ACTIVE' LIMIT 1",
  );
  if (!customer.rows[0] || !product.rows[0]) {
    throw new Error('Le scénario de commande exige un client et un produit actifs.');
  }

  const orderTotal = Number(product.rows[0].unit_price) * 2;
  const extraProduct = await pool.query(
    "SELECT rtrim(product_id) AS id, unit_price FROM zgc_product WHERE rtrim(status) = 'ACTIVE' AND rtrim(product_id) <> $1 LIMIT 1",
    [product.rows[0].id],
  );
  if (!extraProduct.rows[0]) {
    throw new Error('Le test multi-lignes exige deux produits actifs.');
  }
  const orderCreated = await service.createOrder({
    order_id: orderId,
    order_number: `ORD-${orderId.slice(0, 8)}`,
    customer_id: customer.rows[0].id,
    product_id: product.rows[0].id,
    line_id: lineId,
    quantity: 2,
  });
  const extraLineCreated = await service.addOrderLine({
    order_id: orderId,
    line_id: extraLineId,
    product_id: extraProduct.rows[0].id,
    quantity: 1,
  });
  const expectedOrderTotal = orderTotal + Number(extraProduct.rows[0].unit_price);
  const orderStatus = await pool.query(
    `SELECT rtrim(order_status) AS status, total_amount,
            (SELECT COUNT(*)::int FROM zgc_sales_order_line l WHERE rtrim(l.sales_order_id) = $1) AS line_count
       FROM zgc_sales_order WHERE rtrim(sales_order_id) = $1`,
    [orderId],
  );
  if (orderCreated !== 0 || orderStatus.rows[0]?.status !== 'DRAFT'
      || extraLineCreated !== 0 || Number(orderStatus.rows[0]?.total_amount) !== expectedOrderTotal
      || orderStatus.rows[0]?.line_count !== 2) {
    throw new Error(`La commande ABAP multi-lignes a échoué (create=${orderCreated}, add=${extraLineCreated}).`);
  }

  const updatedLine = await service.updateOrderLine({
    order_id: orderId,
    line_id: extraLineId,
    product_id: extraProduct.rows[0].id,
    quantity: 2,
  });
  const updatedOrderTotal = orderTotal + (Number(extraProduct.rows[0].unit_price) * 2);
  const orderAfterLineUpdate = await pool.query(
    'SELECT total_amount FROM zgc_sales_order WHERE rtrim(sales_order_id) = $1',
    [orderId],
  );
  if (updatedLine !== 0 || Number(orderAfterLineUpdate.rows[0]?.total_amount) !== updatedOrderTotal) {
    throw new Error(`La modification de ligne ABAP n’a pas recalculé le total (sy-subrc=${updatedLine}).`);
  }

  const deletedLine = await service.deleteOrderLine(orderId, extraLineId);
  const lastLineDelete = await service.deleteOrderLine(orderId, lineId);
  const orderAfterLineDelete = await pool.query(
    `SELECT total_amount, (SELECT COUNT(*)::int FROM zgc_sales_order_line l
       WHERE rtrim(l.sales_order_id) = $1) AS line_count
       FROM zgc_sales_order WHERE rtrim(sales_order_id) = $1`,
    [orderId],
  );
  if (deletedLine !== 0 || lastLineDelete === 0
      || Number(orderAfterLineDelete.rows[0]?.total_amount) !== orderTotal
      || orderAfterLineDelete.rows[0]?.line_count !== 1) {
    throw new Error('La suppression de ligne ABAP ou la protection de la dernière ligne a échoué.');
  }

  const orderValidated = await service.validateOrder(orderId);
  if (orderValidated !== 0) {
    throw new Error('La validation ABAP de la commande a échoué.');
  }

  const invoiceNumber = `INV-${invoiceId.slice(0, 8)}`;
  const invoiceCreated = await service.generateInvoice({
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    order_id: orderId,
  });
  if (invoiceCreated !== 0) {
    throw new Error('La génération ABAP de la facture a échoué.');
  }

  const firstPayment = await service.recordPayment({
    payment_id: firstPaymentId,
    invoice_id: invoiceId,
    payment_amount: expectedOrderTotal / 2,
    payment_method: 'TRANSFER',
  });
  if (firstPayment !== 0) {
    throw new Error('Le premier paiement ABAP a échoué.');
  }
  const reconciledPayment = await service.reconcilePayment(firstPaymentId);
  const paymentAfterReconcile = await pool.query(
    'SELECT rtrim(payment_status) AS status FROM zgc_payment WHERE rtrim(payment_id) = $1',
    [firstPaymentId],
  );
  if (reconciledPayment !== 0 || paymentAfterReconcile.rows[0]?.status !== 'RECONCILED') {
    throw new Error('La réconciliation ABAP du paiement a échoué.');
  }
  const openInvoice = await pool.query(
    'SELECT rtrim(invoice_status) AS status FROM zgc_invoice WHERE rtrim(invoice_id) = $1',
    [invoiceId],
  );
  if (openInvoice.rows[0]?.status !== 'OPEN') {
    throw new Error('La facture devrait rester ouverte après un paiement partiel.');
  }

  const finalPayment = await service.recordPayment({
    payment_id: secondPaymentId,
    invoice_id: invoiceId,
    payment_amount: expectedOrderTotal / 2,
    payment_method: 'TRANSFER',
  });
  const paidInvoice = await pool.query(
    'SELECT rtrim(invoice_status) AS status FROM zgc_invoice WHERE rtrim(invoice_id) = $1',
    [invoiceId],
  );
  if (finalPayment !== 0 || paidInvoice.rows[0]?.status !== 'PAID') {
    throw new Error('Le règlement complet n’a pas marqué la facture comme payée.');
  }
  if (await service.cancelInvoice(invoiceId) === 0) {
    throw new Error('Une facture payée ne doit pas pouvoir être annulée.');
  }
  const cancelledPayment = await service.cancelPayment(secondPaymentId);
  const invoiceAfterPaymentCancel = await pool.query(
    'SELECT rtrim(invoice_status) AS status FROM zgc_invoice WHERE rtrim(invoice_id) = $1',
    [invoiceId],
  );
  if (cancelledPayment !== 0 || invoiceAfterPaymentCancel.rows[0]?.status !== 'OPEN') {
    throw new Error('L’annulation du paiement doit rouvrir une facture insuffisamment réglée.');
  }
  const restoredPayment = await service.recordPayment({
    payment_id: thirdPaymentId,
    invoice_id: invoiceId,
    payment_amount: expectedOrderTotal / 2,
    payment_method: 'TRANSFER',
  });
  const invoiceAfterRestore = await pool.query(
    'SELECT rtrim(invoice_status) AS status FROM zgc_invoice WHERE rtrim(invoice_id) = $1',
    [invoiceId],
  );
  if (restoredPayment !== 0 || invoiceAfterRestore.rows[0]?.status !== 'PAID') {
    throw new Error('Le nouveau règlement complet n’a pas refermé la facture.');
  }

  const cancelledOrderResult = await service.createOrder({
    order_id: cancelledOrderId,
    order_number: `ORD-CANCEL-${cancelledOrderId.slice(0, 8)}`,
    customer_id: customer.rows[0].id,
    product_id: product.rows[0].id,
    line_id: randomUUID(),
    quantity: 1,
  });
  const cancelledOrderStatus = await service.cancelOrder(cancelledOrderId);
  const cancelledOrder = await pool.query(
    'SELECT rtrim(order_status) AS status FROM zgc_sales_order WHERE rtrim(sales_order_id) = $1',
    [cancelledOrderId],
  );
  if (cancelledOrderResult !== 0 || cancelledOrderStatus !== 0 || cancelledOrder.rows[0]?.status !== 'CANCELLED') {
    throw new Error('L’annulation d’une commande brouillon a échoué.');
  }

  const cancellableOrderCreated = await service.createOrder({
    order_id: cancelledInvoiceOrderId,
    order_number: `ORD-VOID-${cancelledInvoiceOrderId.slice(0, 8)}`,
    customer_id: customer.rows[0].id,
    product_id: product.rows[0].id,
    line_id: randomUUID(),
    quantity: 1,
  });
  const cancellableOrderValidated = await service.validateOrder(cancelledInvoiceOrderId);
  const cancellableInvoiceCreated = await service.generateInvoice({
    invoice_id: cancelledInvoiceId,
    invoice_number: `INV-VOID-${cancelledInvoiceId.slice(0, 8)}`,
    order_id: cancelledInvoiceOrderId,
  });
  const cancellableInvoiceStatus = await service.cancelInvoice(cancelledInvoiceId);
  const cancelledInvoice = await pool.query(
    'SELECT rtrim(invoice_status) AS status FROM zgc_invoice WHERE rtrim(invoice_id) = $1',
    [cancelledInvoiceId],
  );
  if (cancellableOrderCreated !== 0 || cancellableOrderValidated !== 0
      || cancellableInvoiceCreated !== 0 || cancellableInvoiceStatus !== 0
      || cancelledInvoice.rows[0]?.status !== 'CANCELLED') {
    throw new Error('L’annulation d’une facture sans paiement a échoué.');
  }

  const auditResult = await service.writeAudit({
    audit_id: auditId,
    module_name: 'ORDER',
    action_name: 'CREATE',
    actor_name: 'openabap_app',
    action_details: `order_id=${orderId}; lines=2; total=${expectedOrderTotal}`,
  });
  const auditRow = await pool.query(
    'SELECT rtrim(module_name) AS module, rtrim(action_name) AS action FROM zgc_audit_log WHERE rtrim(audit_id) = $1',
    [auditId],
  );
  if (auditResult !== 0 || auditRow.rows[0]?.module !== 'ORDER' || auditRow.rows[0]?.action !== 'CREATE') {
    throw new Error('L’événement d’audit ABAP n’a pas été enregistré.');
  }

  console.log('OpenABAP/PostgreSQL tests passed: customers, products, order lines, cancellation, invoices, payments, audit.');
} finally {
  await pool.query('DELETE FROM zgc_payment WHERE rtrim(invoice_id) = $1', [invoiceId]);
  await pool.query('DELETE FROM zgc_invoice WHERE rtrim(invoice_id) IN ($1, $2)', [invoiceId, cancelledInvoiceId]);
  await pool.query('DELETE FROM zgc_sales_order_line WHERE rtrim(sales_order_id) IN ($1, $2, $3)', [orderId, cancelledOrderId, cancelledInvoiceOrderId]);
  await pool.query('DELETE FROM zgc_sales_order WHERE rtrim(sales_order_id) IN ($1, $2, $3)', [orderId, cancelledOrderId, cancelledInvoiceOrderId]);
  await pool.query('DELETE FROM zgc_audit_log WHERE rtrim(audit_id) = $1', [auditId]);
  await database.disconnect();
  await pool.end();
}