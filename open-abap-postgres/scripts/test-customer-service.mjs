import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresDatabaseClient } from '@abaplint/database-pg';
import { createCustomerService, ensurePostgresSchema } from '../src/customer-service.mjs';

process.loadEnvFile(new URL('../.env', import.meta.url));

const config = {
  user: process.env.PGUSER,
  host: process.env.PGHOST,
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
const invoiceId = randomUUID();
const firstPaymentId = randomUUID();
const secondPaymentId = randomUUID();

try {
  await database.connect();
  await ensurePostgresSchema(pool, database, service.schema);

  await pool.query(
    'DELETE FROM zgc_customer WHERE rtrim(customer_id) = $1',
    [customerId],
  );
  const created = await service.create({
    customer_id: customerId,
    customer_name: '  Test   Client  ',
    customer_email: 'test@example.invalid',
  });
  const afterCreate = await pool.query(
    'SELECT customer_name FROM zgc_customer WHERE rtrim(customer_id) = $1',
    [customerId],
  );
  if (created !== 0 || afterCreate.rows[0]?.customer_name.trimEnd() !== 'Test Client') {
    throw new Error(`La création ABAP a échoué (sy-subrc=${created}, client=${JSON.stringify(afterCreate.rows[0])}).`);
  }

  const updated = await service.update({
    customer_id: customerId,
    customer_name: 'Client Modifie',
    customer_email: 'updated@example.invalid',
  });
  const afterUpdate = await pool.query(
    'SELECT customer_name, customer_email FROM zgc_customer WHERE rtrim(customer_id) = $1',
    [customerId],
  );
  if (updated !== 0 || afterUpdate.rows[0]?.customer_name.trimEnd() !== 'Client Modifie') {
    throw new Error(`La modification ABAP du client a échoué (sy-subrc=${updated}, nom=${afterUpdate.rows[0]?.customer_name.trimEnd()}).`);
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
  const orderCreated = await service.createOrder({
    order_id: orderId,
    order_number: `ORD-${orderId.slice(0, 8)}`,
    customer_id: customer.rows[0].id,
    product_id: product.rows[0].id,
    line_id: lineId,
    quantity: 2,
  });
  const orderStatus = await pool.query(
    'SELECT rtrim(order_status) AS status, total_amount FROM zgc_sales_order WHERE rtrim(sales_order_id) = $1',
    [orderId],
  );
  if (orderCreated !== 0 || orderStatus.rows[0]?.status !== 'DRAFT'
      || Number(orderStatus.rows[0]?.total_amount) !== orderTotal) {
    throw new Error(`La création de commande ABAP a échoué (sy-subrc=${orderCreated}).`);
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
    payment_amount: orderTotal / 2,
    payment_method: 'TRANSFER',
  });
  if (firstPayment !== 0) {
    throw new Error('Le premier paiement ABAP a échoué.');
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
    payment_amount: orderTotal / 2,
    payment_method: 'TRANSFER',
  });
  const paidInvoice = await pool.query(
    'SELECT rtrim(invoice_status) AS status FROM zgc_invoice WHERE rtrim(invoice_id) = $1',
    [invoiceId],
  );
  if (finalPayment !== 0 || paidInvoice.rows[0]?.status !== 'PAID') {
    throw new Error('Le règlement complet n’a pas marqué la facture comme payée.');
  }

  console.log('OpenABAP/PostgreSQL tests passed: customers, products, order, invoice, payments.');
} finally {
  await pool.query('DELETE FROM zgc_payment WHERE rtrim(invoice_id) = $1', [invoiceId]);
  await pool.query('DELETE FROM zgc_invoice WHERE rtrim(invoice_id) = $1', [invoiceId]);
  await pool.query('DELETE FROM zgc_sales_order_line WHERE rtrim(sales_order_id) = $1', [orderId]);
  await pool.query('DELETE FROM zgc_sales_order WHERE rtrim(sales_order_id) = $1', [orderId]);
  await database.disconnect();
  await pool.end();
}