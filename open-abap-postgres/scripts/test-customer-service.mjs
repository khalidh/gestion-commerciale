import process from 'node:process';
import { Pool } from 'pg';
import { PostgresDatabaseClient } from '@abaplint/database-pg';
import { createCustomerService } from '../src/customer-service.mjs';

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

try {
  await database.connect();
  const tableExists = await pool.query("SELECT to_regclass('public.zgc_customer') AS name");
  if (!tableExists.rows[0].name) {
    await database.execute(service.schema);
  }

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
  console.log('OpenABAP/PostgreSQL CRUD test passed: create, update, delete.');
} finally {
  await database.disconnect();
  await pool.end();
}