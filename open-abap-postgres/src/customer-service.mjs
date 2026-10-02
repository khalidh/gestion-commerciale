import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Registry, MemoryFile } from '@abaplint/core';
import { ABAP } from '@abaplint/runtime';
import { Transpiler } from '@abaplint/transpiler';

const sourceDirectory = new URL('./', import.meta.url);

function nativeValue(value) {
  return value?.get instanceof Function ? value.get() : value;
}

export async function createCustomerService(database) {
  const files = await Promise.all([
    readFile(new URL('zgc_customer.tabl.xml', sourceDirectory), 'utf8')
      .then((contents) => new MemoryFile('zgc_customer.tabl.xml', contents)),
    readFile(new URL('zgc_product.tabl.xml', sourceDirectory), 'utf8')
      .then((contents) => new MemoryFile('zgc_product.tabl.xml', contents)),
    readFile(new URL('zgc_sales_order.tabl.xml', sourceDirectory), 'utf8')
      .then((contents) => new MemoryFile('zgc_sales_order.tabl.xml', contents)),
    readFile(new URL('zgc_sales_order_line.tabl.xml', sourceDirectory), 'utf8')
      .then((contents) => new MemoryFile('zgc_sales_order_line.tabl.xml', contents)),
    readFile(new URL('zgc_invoice.tabl.xml', sourceDirectory), 'utf8')
      .then((contents) => new MemoryFile('zgc_invoice.tabl.xml', contents)),
    readFile(new URL('zgc_payment.tabl.xml', sourceDirectory), 'utf8')
      .then((contents) => new MemoryFile('zgc_payment.tabl.xml', contents)),
    readFile(new URL('zgc_audit_log.tabl.xml', sourceDirectory), 'utf8')
      .then((contents) => new MemoryFile('zgc_audit_log.tabl.xml', contents)),
    readFile(new URL('zcl_customer_service.clas.abap', sourceDirectory), 'utf8')
      .then((contents) => new MemoryFile('zcl_customer_service.clas.abap', contents)),
  ]);
  const registry = new Registry().addFiles(files);
  const transpiled = await new Transpiler({ skipVersionCheck: true }).run(registry);
  const abap = new ABAP();
  abap.context.databaseConnections.DEFAULT = database;
  globalThis.abap = abap;

  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  for (const object of transpiled.objects) {
    const loadObject = new AsyncFunction('abap', object.chunk.getCode());
    await loadObject(abap);
  }

  const service = abap.Classes.ZCL_CUSTOMER_SERVICE;
  if (!service) {
    throw new Error('La classe ABAP ZCL_CUSTOMER_SERVICE n’a pas été chargée.');
  }

  return {
    schema: transpiled.databaseSetup.schemas.pg,
    async create(customer) {
      const result = nativeValue(await service.create_customer(customer));
      await database.commit();
      return result;
    },
    async update(customer) {
      const result = nativeValue(await service.update_customer(customer));
      await database.commit();
      return result;
    },
    async delete(customerId) {
      const result = nativeValue(await service.delete_customer({ customer_id: customerId }));
      await database.commit();
      return result;
    },
    async createProduct(product) {
      const result = nativeValue(await service.create_product(product));
      await database.commit();
      return result;
    },
    async updateProduct(product) {
      const result = nativeValue(await service.update_product(product));
      await database.commit();
      return result;
    },
    async deleteProduct(productId) {
      const result = nativeValue(await service.delete_product({ product_id: productId }));
      await database.commit();
      return result;
    },
    async createOrder(order) {
      const result = nativeValue(await service.create_order(order));
      await database.commit();
      return result;
    },
    async validateOrder(orderId) {
      const result = nativeValue(await service.validate_order({ order_id: orderId }));
      await database.commit();
      return result;
    },
    async deliverOrder(orderId) {
      const result = nativeValue(await service.deliver_order({ order_id: orderId }));
      await database.commit();
      return result;
    },
    async cancelOrder(orderId) {
      const result = nativeValue(await service.cancel_order({ order_id: orderId }));
      await database.commit();
      return result;
    },
    async addOrderLine(line) {
      const result = nativeValue(await service.add_order_line(line));
      await database.commit();
      return result;
    },
    async updateOrderLine(line) {
      const result = nativeValue(await service.update_order_line(line));
      await database.commit();
      return result;
    },
    async deleteOrderLine(orderId, lineId) {
      const result = nativeValue(await service.delete_order_line({ order_id: orderId, line_id: lineId }));
      await database.commit();
      return result;
    },
    async generateInvoice(invoice) {
      const result = nativeValue(await service.generate_invoice(invoice));
      await database.commit();
      return result;
    },
    async cancelInvoice(invoiceId) {
      const result = nativeValue(await service.cancel_invoice({ invoice_id: invoiceId }));
      await database.commit();
      return result;
    },
    async recordPayment(payment) {
      const result = nativeValue(await service.record_payment(payment));
      await database.commit();
      return result;
    },
    async reconcilePayment(paymentId) {
      const result = nativeValue(await service.reconcile_payment({ payment_id: paymentId }));
      await database.commit();
      return result;
    },
    async cancelPayment(paymentId) {
      const result = nativeValue(await service.cancel_payment({ payment_id: paymentId }));
      await database.commit();
      return result;
    },
    async writeAudit(entry) {
      const result = nativeValue(await service.write_audit(entry));
      await database.commit();
      return result;
    },
    async normalizeName(customerName) {
      return nativeValue(await service.normalize_name({ customer_name: customerName }));
    },
  };
}

export async function ensurePostgresSchema(pool, database, statements) {
  for (const statement of statements) {
    const tableName = statement.match(/CREATE TABLE\s+"([^"]+)"/i)?.[1];
    if (!tableName) {
      await database.execute(statement);
      continue;
    }
    const result = await pool.query('SELECT to_regclass($1) AS name', [`public.${tableName}`]);
    if (!result.rows[0].name) {
      await database.execute(statement);
    }
  }

  const customerTable = await pool.query("SELECT to_regclass('public.zgc_customer') AS name");
  if (customerTable.rows[0].name) {
    await pool.query("ALTER TABLE zgc_customer ADD COLUMN IF NOT EXISTS customer_code NCHAR(30) NOT NULL DEFAULT ''");
    await pool.query("ALTER TABLE zgc_customer ADD COLUMN IF NOT EXISTS customer_type NCHAR(30) NOT NULL DEFAULT 'CUSTOMER'");
    await pool.query('ALTER TABLE zgc_customer ADD COLUMN IF NOT EXISTS phone NCHAR(50)');
    await pool.query(`UPDATE zgc_customer
                         SET customer_code = 'CUST-' || left(replace(rtrim(customer_id), '-', ''), 12)
                       WHERE btrim(customer_code) = ''`);
    await pool.query('ALTER TABLE zgc_customer ALTER COLUMN customer_code DROP DEFAULT');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS zgc_customer_code_uq ON zgc_customer (customer_code)');
  }
}