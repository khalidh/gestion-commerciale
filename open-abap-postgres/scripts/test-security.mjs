import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Pool } from 'pg';
import { canAccess, createSecurity, saveUser } from '../src/security.mjs';

process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
const controlPool = new Pool();
await controlPool.query(`CREATE SCHEMA ${schema}`);
const pool = new Pool({ options: `-c search_path=${schema}` });
let server;
let integrationUsername;
let integrationCustomerId;
try {
  const security = await createSecurity(pool);
  const password = randomUUID();
  for (const role of ['APP_ADMIN', 'SALES_USER', 'FINANCE_USER', 'REPORT_USER']) {
    await saveUser(pool, role.toLowerCase(), password, role);
  }
  const windowPassword = `${password}\u00e9`;
  await new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [
      fileURLToPath(new URL('./manage-user.mjs', import.meta.url)), 'window_user', 'REPORT_USER', '--stdin-json',
    ], { env: { ...process.env, PGOPTIONS: `-c search_path=${schema}` } }, (error) => error ? reject(error) : resolve());
    child.stdin.end(JSON.stringify({ password: windowPassword, confirmation: windowPassword }));
  });
  const stored = await pool.query('SELECT password_hash FROM gc_auth_users');
  assert(stored.rows.every((row) => row.password_hash.startsWith('scrypt:') && !row.password_hash.includes(password)));
  const app = express();
  app.use(express.json());
  app.use('/api/auth', security.router);
  app.use('/api', security.authorize);
  app.use('/api', (_request, response) => response.json({ ok: true }));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, method = 'GET', cookie = '', body, extraHeaders = {}) => fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-GC-Request': '1', Cookie: cookie, ...extraHeaders },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await send('/api/customers')).status, 401);
  assert.equal((await send('/api/auth/login', 'POST', '', { username: 'window_user', password: windowPassword })).status, 200);
  assert.equal((await send('/api/auth/login', 'POST', '', { username: 'app_admin', password: 'incorrect' })).status, 401);
  assert.equal((await send('/api/auth/login', 'POST', '', { username: 'app_admin', password }, { Origin: 'https://other.example' })).status, 403);
  const cookies = {};
  for (const role of ['APP_ADMIN', 'SALES_USER', 'FINANCE_USER', 'REPORT_USER']) {
    const response = await send('/api/auth/login', 'POST', '', { username: role.toLowerCase(), password });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    cookies[role] = cookie.split(';')[0];
    assert.equal((await send('/api/reports', 'GET', cookies[role])).status, 200);
  }
  assert.equal((await send('/api/customers', 'POST', cookies.REPORT_USER)).status, 403);
  assert.equal((await send('/api/customers', 'POST', cookies.SALES_USER)).status, 200);
  assert.equal((await send('/api/invoices/id/payments', 'POST', cookies.SALES_USER)).status, 403);
  assert.equal((await send('/api/orders/id/invoice', 'POST', cookies.SALES_USER)).status, 403);
  assert.equal((await send('/api/orders/id/INVOICE', 'POST', cookies.SALES_USER)).status, 403);
  assert.equal((await send('/api/ORDERS/id/Invoice/', 'POST', cookies.SALES_USER)).status, 403);
  assert.equal((await send('/api/orders/id/invoice', 'POST', cookies.FINANCE_USER)).status, 200);
  assert.equal((await send('/api/orders/id/deliver', 'POST', cookies.FINANCE_USER)).status, 403);
  assert.equal((await send('/api/payments/id/cancel', 'POST', cookies.FINANCE_USER)).status, 200);
  assert.equal((await send('/api/customers', 'POST', cookies.APP_ADMIN, undefined, { 'X-GC-Request': '' })).status, 403);
  assert.equal((await send('/api/auth/session', 'GET', cookies.APP_ADMIN)).status, 200);
  assert.equal((await send('/api/auth/logout', 'POST', cookies.APP_ADMIN)).status, 204);
  assert.equal((await send('/api/customers', 'GET', cookies.APP_ADMIN)).status, 401);
  await pool.query("UPDATE gc_auth_sessions SET expires_at = NOW() - INTERVAL '1 second'");
  assert.equal((await send('/api/customers', 'GET', cookies.SALES_USER)).status, 401);
  assert.equal(canAccess('UNKNOWN', 'GET', '/reports'), false);
  const disabled = await send('/api/auth/login', 'POST', '', { username: 'report_user', password });
  const disabledCookie = disabled.headers.get('set-cookie').split(';')[0];
  await pool.query("UPDATE gc_auth_users SET active = FALSE WHERE username = 'report_user'");
  assert.equal((await send('/api/customers', 'GET', disabledCookie)).status, 401);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await send('/api/auth/login', 'POST', '', { username: 'unknown', password })).status, 401);
  }
  assert.equal((await send('/api/auth/login', 'POST', '', { username: 'unknown', password })).status, 429);
  if (process.argv.includes('--server')) {
    integrationUsername = `auth-test-${randomUUID()}`;
    await saveUser(controlPool, integrationUsername, password, 'APP_ADMIN');
    const actualBase = `http://127.0.0.1:${process.env.PORT || 3000}`;
    const loginResponse = await fetch(`${actualBase}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GC-Request': '1' },
      body: JSON.stringify({ username: integrationUsername, password }),
    });
    assert.equal(loginResponse.status, 200);
    const actualCookie = loginResponse.headers.get('set-cookie').split(';')[0];
    const actualSend = (path, method = 'GET', body) => fetch(`${actualBase}${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'X-GC-Request': '1', Cookie: actualCookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const path of ['/customers', '/products', '/orders', '/invoices', '/payments', '/reports', '/dashboard', '/audit']) {
      assert.equal((await actualSend(`/api${path}`)).status, 200, `Authenticated read: ${path}`);
    }
    const created = await actualSend('/api/customers', 'POST', {
      customer_name: integrationUsername,
      customer_code: `AUTH-${randomUUID().slice(0, 8).toUpperCase()}`,
    });
    assert.equal(created.status, 201);
    integrationCustomerId = (await created.json()).customer_id;
    const audit = await controlPool.query('SELECT rtrim(actor_name) AS actor FROM zgc_audit_log WHERE rtrim(actor_name) = $1', [integrationUsername]);
    assert(audit.rowCount > 0, 'Authenticated mutation identifies the signed-in audit actor');
    await saveUser(controlPool, integrationUsername, password, 'REPORT_USER');
    assert.equal((await actualSend('/api/customers')).status, 401, 'Changing a role revokes previous sessions');
    const reportLogin = await fetch(`${actualBase}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GC-Request': '1' },
      body: JSON.stringify({ username: integrationUsername, password }),
    });
    assert.equal(reportLogin.status, 200);
    const reportCookie = reportLogin.headers.get('set-cookie').split(';')[0];
    const denied = await fetch(`${actualBase}/api/customers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GC-Request': '1', Cookie: reportCookie }, body: '{}',
    });
    assert.equal(denied.status, 403, 'Real server denies read-only writes');
    console.log('Server integration passed: authenticated reads, mutation audit actor, role changes, session revocation, denied writes.');
  }
  console.log('Security tests passed: password hashing, login, sessions, roles, CSRF, logout, expiry, inactive users, rate limit.');
} finally {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
  await controlPool.query(`DROP SCHEMA ${schema} CASCADE`);
  if (integrationCustomerId) await controlPool.query('DELETE FROM zgc_customer WHERE rtrim(customer_id) = $1', [integrationCustomerId]);
  if (integrationUsername) {
    await controlPool.query('DELETE FROM zgc_audit_log WHERE rtrim(actor_name) = $1', [integrationUsername]);
    await controlPool.query('DELETE FROM gc_auth_users WHERE username = $1', [integrationUsername]);
  }
  await controlPool.end();
}