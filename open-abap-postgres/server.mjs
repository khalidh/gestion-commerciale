import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Pool } from 'pg';
import { PostgresDatabaseClient } from '@abaplint/database-pg';
import { createCustomerService, ensurePostgresSchema } from './src/customer-service.mjs';
import { createSecurity } from './src/security.mjs';

const envPath = fileURLToPath(new URL('./.env', import.meta.url));
try {
  process.loadEnvFile(envPath);
} catch {
  throw new Error('Configuration absente. Lancez npm run setup dans open-abap-postgres.');
}

const config = {
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT),
};
const pool = new Pool(config);
const database = new PostgresDatabaseClient(config);
const customerService = await createCustomerService(database);

await database.connect();
await ensurePostgresSchema(pool, database, customerService.schema);
await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS zgc_product_code_uq ON zgc_product (product_code)');
await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS zgc_sales_order_number_uq ON zgc_sales_order (order_number)');
await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS zgc_invoice_number_uq ON zgc_invoice (invoice_number)');
await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS zgc_invoice_order_uq ON zgc_invoice (sales_order_id)');
await pool.query(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zgc_order_customer_fk') THEN
    ALTER TABLE zgc_sales_order ADD CONSTRAINT zgc_order_customer_fk
      FOREIGN KEY (customer_id) REFERENCES zgc_customer(customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zgc_line_order_fk') THEN
    ALTER TABLE zgc_sales_order_line ADD CONSTRAINT zgc_line_order_fk
      FOREIGN KEY (sales_order_id) REFERENCES zgc_sales_order(sales_order_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zgc_line_product_fk') THEN
    ALTER TABLE zgc_sales_order_line ADD CONSTRAINT zgc_line_product_fk
      FOREIGN KEY (product_id) REFERENCES zgc_product(product_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zgc_invoice_order_fk') THEN
    ALTER TABLE zgc_invoice ADD CONSTRAINT zgc_invoice_order_fk
      FOREIGN KEY (sales_order_id) REFERENCES zgc_sales_order(sales_order_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zgc_invoice_customer_fk') THEN
    ALTER TABLE zgc_invoice ADD CONSTRAINT zgc_invoice_customer_fk
      FOREIGN KEY (customer_id) REFERENCES zgc_customer(customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zgc_payment_invoice_fk') THEN
    ALTER TABLE zgc_payment ADD CONSTRAINT zgc_payment_invoice_fk
      FOREIGN KEY (invoice_id) REFERENCES zgc_invoice(invoice_id) ON DELETE CASCADE;
  END IF;
END $$`);

const count = await pool.query('SELECT COUNT(*)::int AS count FROM zgc_customer');
if (count.rows[0].count === 0) {
  await pool.query(
    `INSERT INTO zgc_customer (customer_id, customer_code, customer_name, customer_type, customer_email, phone, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7), ($8, $9, $10, $11, $12, $13, $14)`,
    [
      randomUUID(), 'CUST-001', 'Acme SA', 'CUSTOMER', 'contact@acme.example', '+1 555 0101', 'ACTIVE',
      randomUUID(), 'CUST-002', 'Globex', 'CUSTOMER', 'sales@globex.example', '+1 555 0102', 'ACTIVE',
    ],
  );
}
const productCount = await pool.query('SELECT COUNT(*)::int AS count FROM zgc_product');
if (productCount.rows[0].count === 0) {
  await pool.query(
    `INSERT INTO zgc_product
       (product_id, product_code, product_name, unit_price, currency_code, status)
     VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12), ($13, $14, $15, $16, $17, $18)`,
    [
      randomUUID(), 'PROD-001', 'Pack Premium', 1250, 'EUR', 'ACTIVE',
      randomUUID(), 'PROD-002', 'Abonnement Pro', 320, 'EUR', 'ACTIVE',
      randomUUID(), 'PROD-003', 'Formation Enterprise', 950, 'EUR', 'ACTIVE',
    ],
  );
}

async function listOrders(orderId) {
  const result = await pool.query(
    `SELECT rtrim(o.sales_order_id) AS sales_order_id,
            rtrim(o.order_number) AS order_number,
            rtrim(o.customer_id) AS customer_id,
            rtrim(c.customer_name) AS customer_name,
            rtrim(o.order_date) AS order_date,
            rtrim(o.order_status) AS order_status,
            o.total_amount,
            string_agg(rtrim(p.product_name) || ' x ' || l.quantity::text, ', ' ORDER BY rtrim(p.product_name)) AS products,
            rtrim(i.invoice_id) AS invoice_id,
            rtrim(i.invoice_number) AS invoice_number
       FROM zgc_sales_order o
       JOIN zgc_customer c ON c.customer_id = o.customer_id
       LEFT JOIN zgc_sales_order_line l ON l.sales_order_id = o.sales_order_id
       LEFT JOIN zgc_product p ON p.product_id = l.product_id
       LEFT JOIN zgc_invoice i ON i.sales_order_id = o.sales_order_id
      WHERE ($1::text IS NULL OR rtrim(o.sales_order_id) = $1)
      GROUP BY o.sales_order_id, o.order_number, o.customer_id, c.customer_name,
               o.order_date, o.order_status, o.total_amount, i.invoice_id, i.invoice_number
           ORDER BY o.order_date DESC, rtrim(o.order_number) DESC`,
    [orderId || null],
  );
  return result.rows.map((order) => ({ ...order, total_amount: Number(order.total_amount) }));
}

async function listOrderLines(orderId) {
  const result = await pool.query(
    `SELECT rtrim(l.sales_order_line_id) AS sales_order_line_id,
            rtrim(l.sales_order_id) AS sales_order_id,
            rtrim(l.product_id) AS product_id,
            rtrim(p.product_name) AS product_name,
            l.quantity,
            l.unit_price,
            l.line_amount
       FROM zgc_sales_order_line l
       JOIN zgc_product p ON p.product_id = l.product_id
      WHERE rtrim(l.sales_order_id) = $1
      ORDER BY rtrim(l.sales_order_line_id)`,
    [orderId],
  );
  return result.rows.map((line) => ({
    ...line,
    quantity: Number(line.quantity),
    unit_price: Number(line.unit_price),
    line_amount: Number(line.line_amount),
  }));
}

async function listInvoices(invoiceId) {
  const result = await pool.query(
    `SELECT rtrim(i.invoice_id) AS invoice_id,
            rtrim(i.invoice_number) AS invoice_number,
            rtrim(i.sales_order_id) AS sales_order_id,
            rtrim(i.customer_id) AS customer_id,
            rtrim(c.customer_name) AS customer_name,
            rtrim(i.invoice_date) AS invoice_date,
            rtrim(i.invoice_status) AS invoice_status,
            i.total_amount,
            COALESCE(SUM(p.payment_amount) FILTER (WHERE rtrim(p.payment_status) <> 'CANCELLED'), 0) AS paid_amount
       FROM zgc_invoice i
       JOIN zgc_customer c ON c.customer_id = i.customer_id
       LEFT JOIN zgc_payment p ON p.invoice_id = i.invoice_id
      WHERE ($1::text IS NULL OR rtrim(i.invoice_id) = $1)
      GROUP BY i.invoice_id, i.invoice_number, i.sales_order_id, i.customer_id,
               c.customer_name, i.invoice_date, i.invoice_status, i.total_amount
      ORDER BY i.invoice_date DESC, rtrim(i.invoice_number) DESC`,
    [invoiceId || null],
  );
  return result.rows.map((invoice) => {
    const total = Number(invoice.total_amount);
    const paid = Number(invoice.paid_amount);
    return {
      ...invoice,
      total_amount: total,
      paid_amount: paid,
      remaining_amount: Math.max(total - paid, 0),
    };
  });
}

const app = express();
const requestContext = new AsyncLocalStorage();
const security = await createSecurity(pool);
app.use(express.json({ limit: '32kb' }));
app.use('/api/auth', security.router);
app.use('/api', security.authorize, (request, _response, next) => requestContext.run(request.user, next));
app.use(express.static(fileURLToPath(new URL('./webapp/', import.meta.url))));

async function findCustomer(customerId) {
  const result = await pool.query(
    `SELECT rtrim(customer_id) AS customer_id,
            rtrim(customer_code) AS customer_code,
            rtrim(customer_name) AS customer_name,
            rtrim(customer_type) AS customer_type,
            rtrim(customer_email) AS customer_email,
            rtrim(phone) AS phone,
            rtrim(status) AS status
       FROM zgc_customer
      WHERE rtrim(customer_id) = $1`,
    [customerId],
  );
  return result.rows[0];
}

function customerInput(body) {
  const customerCode = String(body?.customer_code ?? '').trim().toUpperCase()
    || `CUST-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const name = String(body?.customer_name ?? '');
  const customerType = String(body?.customer_type ?? 'CUSTOMER').trim().toUpperCase();
  const email = String(body?.customer_email ?? '').trim();
  const phone = String(body?.phone ?? '').trim();
  const status = String(body?.status ?? 'ACTIVE').trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,30}$/.test(customerCode)) {
    const error = new Error('Le code client doit contenir uniquement lettres, chiffres et tirets.');
    error.status = 400;
    throw error;
  }
  if (!name.trim()) {
    const error = new Error('Le nom du client est obligatoire.');
    error.status = 400;
    throw error;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('Adresse e-mail invalide.');
    error.status = 400;
    throw error;
  }
  if (!['CUSTOMER', 'PROSPECT', 'PARTNER', 'SUPPLIER'].includes(customerType)
      || !['ACTIVE', 'INACTIVE'].includes(status)) {
    const error = new Error('Le type ou le statut du client est invalide.');
    error.status = 400;
    throw error;
  }
  return {
    customer_code: customerCode,
    customer_name: name,
    customer_type: customerType,
    customer_email: email,
    phone,
    status,
  };
}

function productInput(body) {
  const productCode = String(body?.product_code ?? '').trim().toUpperCase();
  const productName = String(body?.product_name ?? '');
  const unitPrice = Number(body?.unit_price);
  const currencyCode = String(body?.currency_code ?? 'EUR').trim().toUpperCase();
  if (!productCode || !productName.trim()) {
    const error = new Error('Le code et le nom du produit sont obligatoires.');
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    const error = new Error('Le prix doit être un nombre positif ou nul.');
    error.status = 400;
    throw error;
  }
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    const error = new Error('La devise doit être un code ISO de trois lettres.');
    error.status = 400;
    throw error;
  }
  return { product_code: productCode, product_name: productName, unit_price: unitPrice, currency_code: currencyCode };
}

function orderInput(body) {
  const customerId = String(body?.customer_id ?? '').trim();
  const productId = String(body?.product_id ?? '').trim();
  const quantity = Number(body?.quantity);
  if (!customerId || !productId || !Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error('Sélectionne un client, un produit et une quantité positive.');
    error.status = 400;
    throw error;
  }
  return { customer_id: customerId, product_id: productId, quantity };
}

function amountInput(body) {
  const amount = Number(body?.amount);
  const allowedMethods = new Set(['TRANSFER', 'CARD', 'CHEQUE']);
  const method = String(body?.payment_method ?? 'TRANSFER').trim().toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0 || !allowedMethods.has(method)) {
    const error = new Error('Montant ou mode de paiement invalide.');
    error.status = 400;
    throw error;
  }
  return { amount, method };
}

async function writeAudit(moduleName, actionName, actionDetails) {
  const result = await customerService.writeAudit({
    audit_id: randomUUID(),
    module_name: moduleName,
    action_name: actionName,
    actor_name: requestContext.getStore()?.username || 'openabap_app',
    action_details: actionDetails,
  });
  if (result !== 0) {
    throw new Error(`Échec d’écriture du journal d’audit: ${moduleName}/${actionName}`);
  }
}

app.get('/api/customers', async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT rtrim(customer_id) AS customer_id,
              rtrim(customer_code) AS customer_code,
              rtrim(customer_name) AS customer_name,
              rtrim(customer_type) AS customer_type,
              rtrim(customer_email) AS customer_email,
              rtrim(phone) AS phone,
              rtrim(status) AS status
         FROM zgc_customer
        ORDER BY rtrim(customer_name)`,
    );
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT rtrim(product_id) AS product_id,
              rtrim(product_code) AS product_code,
              rtrim(product_name) AS product_name,
              unit_price,
              rtrim(currency_code) AS currency_code,
              rtrim(status) AS status
         FROM zgc_product
        ORDER BY rtrim(product_name)`,
    );
    response.json(result.rows.map((product) => ({ ...product, unit_price: Number(product.unit_price) })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', async (request, response, next) => {
  try {
    const product = {
      product_id: randomUUID(),
      ...productInput(request.body),
    };
    product.product_name = await customerService.normalizeName(product.product_name);
    const result = await customerService.createProduct(product);
    if (result !== 0) {
      return response.status(409).json({ error: 'product_not_created' });
    }
    await writeAudit('PRODUCT', 'CREATE', `product_id=${product.product_id}; code=${product.product_code}`);
    const created = await pool.query(
      `SELECT rtrim(product_id) AS product_id, rtrim(product_code) AS product_code,
              rtrim(product_name) AS product_name, unit_price,
              rtrim(currency_code) AS currency_code, rtrim(status) AS status
         FROM zgc_product WHERE rtrim(product_id) = $1`,
      [product.product_id],
    );
    response.status(201).json({ ...created.rows[0], unit_price: Number(created.rows[0].unit_price) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/products/:id', async (request, response, next) => {
  try {
    const existing = await pool.query(
      'SELECT 1 FROM zgc_product WHERE rtrim(product_id) = $1',
      [request.params.id],
    );
    if (existing.rowCount === 0) {
      return response.status(404).json({ error: 'product_not_found' });
    }
    const product = productInput(request.body);
    const status = request.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await customerService.updateProduct({
      product_id: request.params.id,
      ...product,
      status,
    });
    if (result !== 0) {
      return response.status(404).json({ error: 'product_not_found' });
    }
    await writeAudit('PRODUCT', 'UPDATE', `product_id=${request.params.id}; status=${status}`);
    const updated = await pool.query(
      `SELECT rtrim(product_id) AS product_id, rtrim(product_code) AS product_code,
              rtrim(product_name) AS product_name, unit_price,
              rtrim(currency_code) AS currency_code, rtrim(status) AS status
         FROM zgc_product WHERE rtrim(product_id) = $1`,
      [request.params.id],
    );
    response.json({ ...updated.rows[0], unit_price: Number(updated.rows[0].unit_price) });
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({ error: 'product_code_exists' });
    }
    next(error);
  }
});

app.delete('/api/products/:id', async (request, response, next) => {
  try {
    const result = await customerService.deleteProduct(request.params.id);
    if (result !== 0) {
      return response.status(409).json({ error: 'product_in_use_or_not_found' });
    }
    await writeAudit('PRODUCT', 'DELETE', `product_id=${request.params.id}`);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders', async (_request, response, next) => {
  try {
    response.json(await listOrders());
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', async (request, response, next) => {
  try {
    const input = orderInput(request.body);
    const [customer, product] = await Promise.all([
      pool.query("SELECT 1 FROM zgc_customer WHERE rtrim(customer_id) = $1 AND rtrim(status) = 'ACTIVE'", [input.customer_id]),
      pool.query("SELECT unit_price FROM zgc_product WHERE rtrim(product_id) = $1 AND rtrim(status) = 'ACTIVE'", [input.product_id]),
    ]);
    if (customer.rowCount === 0 || product.rowCount === 0) {
      return response.status(400).json({ error: 'active_customer_and_product_required' });
    }
    const orderId = randomUUID();
    const result = await customerService.createOrder({
      order_id: orderId,
      order_number: `ORD-${Date.now()}`,
      customer_id: input.customer_id,
      product_id: input.product_id,
      line_id: randomUUID(),
      quantity: input.quantity,
    });
    if (result !== 0) {
      return response.status(409).json({ error: 'order_not_created' });
    }
    await writeAudit('ORDER', 'CREATE', `sales_order_id=${orderId}; customer_id=${input.customer_id}`);
    response.status(201).json((await listOrders(orderId))[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders/:id/lines', async (request, response, next) => {
  try {
    const orderId = request.params.id;
    const quantity = Number(request.body?.quantity);
    const productId = String(request.body?.product_id ?? '').trim();
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return response.status(400).json({ error: 'product_and_positive_quantity_required' });
    }
    const order = await pool.query(
      "SELECT 1 FROM zgc_sales_order WHERE rtrim(sales_order_id) = $1 AND rtrim(order_status) = 'DRAFT'",
      [orderId],
    );
    const product = await pool.query(
      "SELECT 1 FROM zgc_product WHERE rtrim(product_id) = $1 AND rtrim(status) = 'ACTIVE'",
      [productId],
    );
    if (order.rowCount === 0 || product.rowCount === 0) {
      return response.status(409).json({ error: 'draft_order_and_active_product_required' });
    }
    const result = await customerService.addOrderLine({
      order_id: orderId,
      line_id: randomUUID(),
      product_id: productId,
      quantity,
    });
    if (result !== 0) {
      return response.status(409).json({ error: 'order_line_not_added' });
    }
    await writeAudit('ORDER', 'ADD_LINE', `sales_order_id=${orderId}; product_id=${productId}; quantity=${quantity}`);
    response.status(201).json((await listOrders(orderId))[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders/:id/lines', async (request, response, next) => {
  try {
    const order = await pool.query('SELECT 1 FROM zgc_sales_order WHERE rtrim(sales_order_id) = $1', [request.params.id]);
    if (order.rowCount === 0) {
      return response.status(404).json({ error: 'order_not_found' });
    }
    response.json(await listOrderLines(request.params.id));
  } catch (error) {
    next(error);
  }
});

app.put('/api/orders/:id/lines/:lineId', async (request, response, next) => {
  try {
    const orderId = request.params.id;
    const lineId = request.params.lineId;
    const productId = String(request.body?.product_id ?? '').trim();
    const quantity = Number(request.body?.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return response.status(400).json({ error: 'product_and_positive_quantity_required' });
    }
    const result = await customerService.updateOrderLine({
      order_id: orderId,
      line_id: lineId,
      product_id: productId,
      quantity,
    });
    if (result !== 0) {
      return response.status(409).json({ error: 'only_existing_draft_order_lines_can_be_updated' });
    }
    await writeAudit('ORDER', 'UPDATE_LINE', `sales_order_id=${orderId}; line_id=${lineId}; product_id=${productId}; quantity=${quantity}`);
    response.json({ order: (await listOrders(orderId))[0], lines: await listOrderLines(orderId) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/orders/:id/lines/:lineId', async (request, response, next) => {
  try {
    const orderId = request.params.id;
    const lineId = request.params.lineId;
    const result = await customerService.deleteOrderLine(orderId, lineId);
    if (result !== 0) {
      return response.status(409).json({ error: 'only_draft_orders_with_multiple_lines_can_remove_a_line' });
    }
    await writeAudit('ORDER', 'DELETE_LINE', `sales_order_id=${orderId}; line_id=${lineId}`);
    response.json({ order: (await listOrders(orderId))[0], lines: await listOrderLines(orderId) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders/:id/validate', async (request, response, next) => {
  try {
    const result = await customerService.validateOrder(request.params.id);
    if (result !== 0) {
      return response.status(409).json({ error: 'order_not_draft_or_not_found' });
    }
    await writeAudit('ORDER', 'VALIDATE', `sales_order_id=${request.params.id}`);
    response.json((await listOrders(request.params.id))[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders/:id/deliver', async (request, response, next) => {
  try {
    const result = await customerService.deliverOrder(request.params.id);
    if (result !== 0) {
      return response.status(409).json({ error: 'only_validated_orders_can_be_delivered' });
    }
    await writeAudit('ORDER', 'DELIVER', `sales_order_id=${request.params.id}`);
    response.json((await listOrders(request.params.id))[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders/:id/cancel', async (request, response, next) => {
  try {
    const result = await customerService.cancelOrder(request.params.id);
    if (result !== 0) {
      return response.status(409).json({ error: 'only_uninvoiced_draft_orders_can_be_cancelled' });
    }
    await writeAudit('ORDER', 'CANCEL', `sales_order_id=${request.params.id}`);
    response.json((await listOrders(request.params.id))[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders/:id/invoice', async (request, response, next) => {
  try {
    const order = (await listOrders(request.params.id))[0];
    if (!order) {
      return response.status(404).json({ error: 'order_not_found' });
    }
    const invoiceId = randomUUID();
    const invoiceNumber = `INV-${Date.now()}`;
    const result = await customerService.generateInvoice({
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      order_id: order.sales_order_id,
    });
    if (result !== 0) {
      return response.status(409).json({ error: 'invoice_requires_validated_order_or_already_exists' });
    }
    await writeAudit('INVOICE', 'GENERATE', `invoice_id=${invoiceId}; sales_order_id=${order.sales_order_id}`);
    response.status(201).json((await listInvoices(invoiceId))[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/invoices', async (_request, response, next) => {
  try {
    response.json(await listInvoices());
  } catch (error) {
    next(error);
  }
});

app.post('/api/invoices/:id/cancel', async (request, response, next) => {
  try {
    const invoice = (await listInvoices(request.params.id))[0];
    if (!invoice) {
      return response.status(404).json({ error: 'invoice_not_found' });
    }
    if (invoice.invoice_status !== 'OPEN' || invoice.paid_amount > 0) {
      return response.status(409).json({ error: 'only_unpaid_open_invoices_can_be_cancelled' });
    }
    const result = await customerService.cancelInvoice(invoice.invoice_id);
    if (result !== 0) {
      return response.status(409).json({ error: 'invoice_not_cancellable' });
    }
    await writeAudit('INVOICE', 'CANCEL', `invoice_id=${invoice.invoice_id}`);
    response.json((await listInvoices(invoice.invoice_id))[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/invoices/:id/payments', async (request, response, next) => {
  try {
    const invoice = (await listInvoices(request.params.id))[0];
    if (!invoice) {
      return response.status(404).json({ error: 'invoice_not_found' });
    }
    const paymentInput = amountInput(request.body);
    if (invoice.invoice_status !== 'OPEN' || invoice.remaining_amount <= 0) {
      return response.status(409).json({ error: 'invoice_not_open_for_payment' });
    }
    if (paymentInput.amount > invoice.remaining_amount) {
      return response.status(409).json({ error: 'payment_exceeds_invoice_balance' });
    }
    const result = await customerService.recordPayment({
      payment_id: randomUUID(),
      invoice_id: invoice.invoice_id,
      payment_amount: paymentInput.amount,
      payment_method: paymentInput.method,
    });
    if (result !== 0) {
      return response.status(409).json({ error: 'payment_not_recorded' });
    }
    await writeAudit('PAYMENT', 'REGISTER', `invoice_id=${invoice.invoice_id}; amount=${paymentInput.amount}; method=${paymentInput.method}`);
    response.status(201).json((await listInvoices(invoice.invoice_id))[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/payments', async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT rtrim(p.payment_id) AS payment_id,
              rtrim(p.invoice_id) AS invoice_id,
              rtrim(i.invoice_number) AS invoice_number,
              rtrim(c.customer_name) AS customer_name,
              rtrim(p.payment_date) AS payment_date,
              p.payment_amount,
              rtrim(p.payment_method) AS payment_method,
              rtrim(p.payment_status) AS payment_status
         FROM zgc_payment p
         JOIN zgc_invoice i ON i.invoice_id = p.invoice_id
         JOIN zgc_customer c ON c.customer_id = i.customer_id
        ORDER BY p.payment_date DESC, rtrim(p.payment_id) DESC`,
    );
    response.json(result.rows.map((payment) => ({ ...payment, payment_amount: Number(payment.payment_amount) })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/:id/reconcile', async (request, response, next) => {
  try {
    const result = await customerService.reconcilePayment(request.params.id);
    if (result !== 0) {
      return response.status(409).json({ error: 'only_registered_payments_can_be_reconciled' });
    }
    await writeAudit('PAYMENT', 'RECONCILE', `payment_id=${request.params.id}`);
    const payment = await pool.query(
      `SELECT rtrim(payment_id) AS payment_id, rtrim(invoice_id) AS invoice_id,
              payment_amount, rtrim(payment_method) AS payment_method,
              rtrim(payment_status) AS payment_status
         FROM zgc_payment WHERE rtrim(payment_id) = $1`,
      [request.params.id],
    );
    response.json({ ...payment.rows[0], payment_amount: Number(payment.rows[0].payment_amount) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/:id/cancel', async (request, response, next) => {
  try {
    const result = await customerService.cancelPayment(request.params.id);
    if (result !== 0) {
      return response.status(409).json({ error: 'payment_not_cancellable' });
    }
    await writeAudit('PAYMENT', 'CANCEL', `payment_id=${request.params.id}`);
    const payment = await pool.query(
      `SELECT rtrim(payment_id) AS payment_id, rtrim(invoice_id) AS invoice_id,
              payment_amount, rtrim(payment_method) AS payment_method,
              rtrim(payment_status) AS payment_status
         FROM zgc_payment WHERE rtrim(payment_id) = $1`,
      [request.params.id],
    );
    response.json({ ...payment.rows[0], payment_amount: Number(payment.rows[0].payment_amount) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/audit', async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT rtrim(audit_id) AS audit_id,
              rtrim(module_name) AS module_name,
              rtrim(action_name) AS action_name,
              rtrim(actor_name) AS actor_name,
              rtrim(action_details) AS action_details,
              rtrim(created_date) AS created_date
         FROM zgc_audit_log
        ORDER BY rtrim(created_date) DESC, rtrim(audit_id) DESC`,
    );
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard', async (_request, response, next) => {
  try {
    const [customers, products, orders, invoices, payments] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM zgc_customer WHERE rtrim(status) = 'ACTIVE'"),
      pool.query("SELECT COUNT(*)::int AS count FROM zgc_product WHERE rtrim(status) = 'ACTIVE'"),
      pool.query("SELECT COUNT(*)::int AS count FROM zgc_sales_order WHERE rtrim(order_status) = 'VALIDATED'"),
      pool.query("SELECT COALESCE(SUM(total_amount), 0) AS total FROM zgc_invoice WHERE rtrim(invoice_status) <> 'CANCELLED'"),
      pool.query("SELECT COALESCE(SUM(payment_amount), 0) AS total FROM zgc_payment WHERE rtrim(payment_status) <> 'CANCELLED'"),
    ]);
    response.json({
      active_customers: customers.rows[0].count,
      active_products: products.rows[0].count,
      validated_orders: orders.rows[0].count,
      invoiced_amount: Number(invoices.rows[0].total),
      paid_amount: Number(payments.rows[0].total),
      outstanding_amount: Number(invoices.rows[0].total) - Number(payments.rows[0].total),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reports', async (request, response, next) => {
  try {
    function parseReportDate(value) {
      if (!value) return '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const error = new Error('Les dates doivent être au format YYYY-MM-DD.');
        error.status = 400;
        throw error;
      }
      const parsed = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
        const error = new Error('La période contient une date invalide.');
        error.status = 400;
        throw error;
      }
      return value.replaceAll('-', '');
    }

    const from = parseReportDate(String(request.query.from ?? ''));
    const to = parseReportDate(String(request.query.to ?? ''));
    if (from && to && from > to) {
      return response.status(400).json({ error: 'from_must_not_be_after_to' });
    }

    const [sales, payments, invoices] = await Promise.all([
      pool.query(
        `SELECT rtrim(p.product_id) AS product_id,
                rtrim(p.product_code) AS product_code,
                rtrim(p.product_name) AS product_name,
                SUM(l.quantity) AS quantity_sold,
                SUM(l.line_amount) AS revenue
           FROM zgc_sales_order_line l
           JOIN zgc_sales_order o ON o.sales_order_id = l.sales_order_id
           JOIN zgc_product p ON p.product_id = l.product_id
          WHERE rtrim(o.order_status) IN ('VALIDATED', 'DELIVERED')
            AND ($1 = '' OR rtrim(o.order_date) >= $1)
            AND ($2 = '' OR rtrim(o.order_date) <= $2)
          GROUP BY p.product_id, p.product_code, p.product_name
          ORDER BY SUM(l.line_amount) DESC, rtrim(p.product_name)`,
          [from, to],
      ),
      pool.query(
        `SELECT rtrim(payment_date) AS payment_date,
                SUM(payment_amount) AS amount,
                COUNT(*)::int AS payment_count
           FROM zgc_payment
          WHERE rtrim(payment_status) <> 'CANCELLED'
            AND ($1 = '' OR rtrim(payment_date) >= $1)
            AND ($2 = '' OR rtrim(payment_date) <= $2)
          GROUP BY rtrim(payment_date)
          ORDER BY rtrim(payment_date)`,
        [from, to],
      ),
      listInvoices(),
    ]);
    response.json({
      from_date: from ? `${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}` : null,
      to_date: to ? `${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6, 8)}` : null,
      sales_by_product: sales.rows.map((row) => ({
        ...row,
        quantity_sold: Number(row.quantity_sold),
        revenue: Number(row.revenue),
      })),
      payments_by_day: payments.rows.map((row) => ({
        ...row,
        amount: Number(row.amount),
      })),
      open_invoice_balances: invoices.filter((invoice) => invoice.invoice_status === 'OPEN' && invoice.remaining_amount > 0),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/customers', async (request, response, next) => {
  try {
    const input = customerInput(request.body);
    input.customer_name = await customerService.normalizeName(input.customer_name);
    const customer = { customer_id: randomUUID(), ...input };
    const result = await customerService.create(customer);
    if (result !== 0) {
      return response.status(409).json({ error: 'customer_not_created' });
    }
    await writeAudit('CUSTOMER', 'CREATE', `customer_id=${customer.customer_id}; code=${customer.customer_code}`);
    response.status(201).json(await findCustomer(customer.customer_id));
  } catch (error) {
    next(error);
  }
});

app.put('/api/customers/:id', async (request, response, next) => {
  try {
    const existing = await findCustomer(request.params.id);
    if (!existing) {
      return response.status(404).json({ error: 'customer_not_found' });
    }
    const input = customerInput(request.body);
    input.customer_name = await customerService.normalizeName(input.customer_name);
    const result = await customerService.update({
      customer_id: request.params.id,
      customer_name: input.customer_name,
      customer_type: input.customer_type,
      customer_email: input.customer_email,
      phone: input.phone,
      status: input.status,
    });
    if (result !== 0) {
      return response.status(404).json({ error: 'customer_not_found' });
    }
    await writeAudit('CUSTOMER', 'UPDATE', `customer_id=${request.params.id}; status=${input.status}`);
    response.json(await findCustomer(request.params.id));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/customers/:id', async (request, response, next) => {
  try {
    const result = await customerService.delete(request.params.id);
    if (result !== 0) {
      return response.status(404).json({ error: 'customer_not_found' });
    }
    await writeAudit('CUSTOMER', 'DELETE', `customer_id=${request.params.id}`);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 500).json({ error: error.message || 'internal_error' });
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`OpenABAP/PostgreSQL clients running at http://127.0.0.1:${port}`);
});

async function shutdown() {
  server.close();
  await database.disconnect();
  await pool.end();
}

process.on('SIGINT', () => shutdown().finally(() => process.exit(0)));
process.on('SIGTERM', () => shutdown().finally(() => process.exit(0)));