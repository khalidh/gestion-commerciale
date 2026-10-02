import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Registry, MemoryFile } from '@abaplint/core';
import { PostgresDatabaseClient } from '@abaplint/database-pg';
import { ABAP } from '@abaplint/runtime';
import { Transpiler } from '@abaplint/transpiler';

const projectUrl = new URL('../', import.meta.url);
process.loadEnvFile(fileURLToPath(new URL('.env', projectUrl)));

const sourceUrl = new URL('./customer_count.prog.abap', import.meta.url);
const tableUrl = new URL('./zopenabap_customer.tabl.xml', import.meta.url);
const files = [
  new MemoryFile('zcustomer_count.prog.abap', await readFile(sourceUrl, 'utf8')),
  new MemoryFile('zopenabap_customer.tabl.xml', await readFile(tableUrl, 'utf8')),
];
const registry = new Registry().addFiles(files);
const result = await new Transpiler({ skipVersionCheck: true }).run(registry);
const program = result.objects.find((object) => object.object.type === 'PROG');
if (!program) {
  throw new Error('Le programme ABAP zcustomer_count n’a pas été transpile.');
}

const database = new PostgresDatabaseClient({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT),
});
const abap = new ABAP();
abap.context.databaseConnections.DEFAULT = database;
globalThis.abap = abap;

try {
  await database.connect();
  await database.execute('DROP TABLE IF EXISTS "zopenabap_customer" CASCADE');
  await database.execute(result.databaseSetup.schemas.pg);
  await database.execute(result.databaseSetup.insert);
  await database.execute([
    'DELETE FROM "zopenabap_customer"',
    `INSERT INTO "zopenabap_customer" ("customer_id", "customer_name") VALUES
      (1, 'Acme SA'),
      (2, 'Globex')`,
  ]);

  const tableCode = result.objects
    .filter((object) => object.object.type === 'TABL')
    .map((object) => object.chunk.getCode())
    .join('\n');
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const executeProgram = new AsyncFunction('abap', `${tableCode}\n${program.chunk.getCode()}`);
  await executeProgram(abap);

  console.log(`SELECT COUNT(*) via OpenABAP/PostgreSQL: ${abap.console.get().trim()}`);
} finally {
  await database.disconnect();
}