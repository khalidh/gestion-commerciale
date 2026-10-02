import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

function readSecret(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Lancez npm run setup depuis un terminal interactif.');
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = '';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();

    const onData = (buffer) => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\u0003') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          reject(new Error('Configuration annulee.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };

    input.on('data', onData);
  });
}

const password = process.env.PG_ADMIN_PASSWORD || await readSecret('Mot de passe local du compte PostgreSQL postgres: ');
if (!password) {
  throw new Error('Le mot de passe PostgreSQL est obligatoire.');
}

const connection = new Client({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'postgres',
  password,
  port: 5432,
});

const appPassword = randomBytes(32).toString('base64url');
const envPath = fileURLToPath(new URL('../.env', import.meta.url));

try {
  await connection.connect();

  const roleResult = await connection.query(
    "SELECT 1 FROM pg_roles WHERE rolname = 'openabap_app'",
  );
  if (roleResult.rowCount === 0) {
    await connection.query('CREATE ROLE openabap_app LOGIN');
  }
  await connection.query(`ALTER ROLE openabap_app WITH LOGIN PASSWORD '${appPassword}'`);

  const databaseResult = await connection.query(
    "SELECT 1 FROM pg_database WHERE datname = 'openabap_demo'",
  );
  if (databaseResult.rowCount === 0) {
    await connection.query('CREATE DATABASE openabap_demo OWNER openabap_app');
  } else {
    await connection.query('ALTER DATABASE openabap_demo OWNER TO openabap_app');
  }

  await writeFile(envPath, [
    'PGHOST=127.0.0.1',
    'PGPORT=5432',
    'PGDATABASE=openabap_demo',
    'PGUSER=openabap_app',
    `PGPASSWORD=${appPassword}`,
    '',
  ].join('\n'), { encoding: 'utf8', flag: 'w' });

  console.log(`Base openabap_demo et role openabap_app prets. Configuration locale: ${envPath}`);
} finally {
  await connection.end();
}