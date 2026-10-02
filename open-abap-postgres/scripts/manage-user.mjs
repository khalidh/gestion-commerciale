import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { ensureSecuritySchema, saveUser } from '../src/security.mjs';

function readSecret(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Lancez cette commande dans un terminal interactif.');
  }
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = '';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    const onData = (buffer) => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\u0003' || character === '\r' || character === '\n') {
          input.setRawMode(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          if (character === '\u0003') reject(new Error('Operation annulee.'));
          else resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else value += character;
      }
    };
    input.on('data', onData);
  });
}

const [username, role] = process.argv.slice(2);
if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username || '')
    || !['APP_ADMIN', 'SALES_USER', 'FINANCE_USER', 'REPORT_USER', '--disable'].includes(role)) {
  throw new Error('Usage: npm run user -- identifiant APP_ADMIN|SALES_USER|FINANCE_USER|REPORT_USER|--disable');
}
process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
const pool = new Pool();
try {
  await ensureSecuritySchema(pool);
  if (role === '--disable') {
    const result = await pool.query('UPDATE gc_auth_users SET active = FALSE WHERE username = $1 RETURNING username', [username]);
    if (!result.rowCount) throw new Error('Compte introuvable.');
    await pool.query('DELETE FROM gc_auth_sessions WHERE username = $1', [username]);
    console.log(`Compte ${username} desactive; sessions revoquees.`);
  } else {
    const password = await readSecret(`Mot de passe du compte ${username} (12 caracteres minimum): `);
    const confirmation = await readSecret('Confirmez le mot de passe: ');
    if (password !== confirmation) throw new Error('Les mots de passe ne correspondent pas.');
    await saveUser(pool, username, password, role);
    console.log(`Compte ${username} cree ou actualise (${role}); anciennes sessions revoquees.`);
  }
} finally {
  await pool.end();
}