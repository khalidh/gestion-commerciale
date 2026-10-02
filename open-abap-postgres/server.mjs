import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Pool } from 'pg';
import { PostgresDatabaseClient } from '@abaplint/database-pg';
import { createCustomerService } from './src/customer-service.mjs';

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
const table = await pool.query("SELECT to_regclass('public.zgc_customer') AS name");
if (!table.rows[0].name) {
  await database.execute(customerService.schema);
}

const count = await pool.query('SELECT COUNT(*)::int AS count FROM zgc_customer');
if (count.rows[0].count === 0) {
  await pool.query(
    `INSERT INTO zgc_customer (customer_id, customer_name, customer_email, status)
     VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      randomUUID(), 'Acme SA', 'contact@acme.example', 'ACTIVE',
      randomUUID(), 'Globex', 'sales@globex.example', 'ACTIVE',
    ],
  );
}

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(express.static(fileURLToPath(new URL('./webapp/', import.meta.url))));

async function findCustomer(customerId) {
  const result = await pool.query(
    `SELECT rtrim(customer_id) AS customer_id,
            rtrim(customer_name) AS customer_name,
            rtrim(customer_email) AS customer_email,
            rtrim(status) AS status
       FROM zgc_customer
      WHERE rtrim(customer_id) = $1`,
    [customerId],
  );
  return result.rows[0];
}

function customerInput(body) {
  const name = String(body?.customer_name ?? '');
  const email = String(body?.customer_email ?? '').trim();
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
  return { customer_name: name, customer_email: email };
}

app.get('/api/customers', async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT rtrim(customer_id) AS customer_id,
              rtrim(customer_name) AS customer_name,
              rtrim(customer_email) AS customer_email,
              rtrim(status) AS status
         FROM zgc_customer
        ORDER BY rtrim(customer_name)`,
    );
    response.json(result.rows);
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
      ...input,
    });
    if (result !== 0) {
      return response.status(404).json({ error: 'customer_not_found' });
    }
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