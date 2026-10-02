import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import express from 'express';

const deriveKey = promisify(scrypt);
const roles = ['APP_ADMIN', 'SALES_USER', 'FINANCE_USER', 'REPORT_USER'];
const cookieName = 'gc_session';
const sessionSeconds = 8 * 60 * 60;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, salt, expected] = encoded.split(':');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(expected)) return false;
  const actual = await deriveKey(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function ensureSecuritySchema(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS gc_auth_users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('APP_ADMIN', 'SALES_USER', 'FINANCE_USER', 'REPORT_USER')),
    active BOOLEAN NOT NULL DEFAULT TRUE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gc_auth_sessions (
    token_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL REFERENCES gc_auth_users(username) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`);
}

export async function saveUser(pool, username, password, role) {
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username) || !roles.includes(role)
      || typeof password !== 'string' || password.length < 12 || password.length > 1024) {
    throw new Error('Identifiant invalide, role inconnu ou mot de passe hors limites (12 a 1024 caracteres).');
  }
  const encoded = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO gc_auth_users (username, password_hash, role) VALUES ($1, $2, $3)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role, active = TRUE`, [username, encoded, role]);
    await client.query('DELETE FROM gc_auth_sessions WHERE username = $1', [username]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function canAccess(role, method, path) {
  if (!roles.includes(role)) return false;
  if (['GET', 'HEAD'].includes(method)) return true;
  if (role === 'APP_ADMIN') return true;
  if (role === 'SALES_USER') return /^\/(customers|products|orders)(\/|$)/i.test(path)
    && !/^\/orders\/[^/]+\/invoice\/?$/i.test(path);
  if (role === 'FINANCE_USER') return /^\/(invoices|payments)(\/|$)/i.test(path)
    || (method === 'POST' && /^\/orders\/[^/]+\/invoice\/?$/i.test(path));
  return false;
}

export async function createSecurity(pool) {
  await ensureSecuritySchema(pool);
  const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
  const attempts = new Map();
  const router = express.Router();

  function guardWrite(request, response, next) {
    if (['GET', 'HEAD'].includes(request.method)) return next();
    const expectedOrigin = `${request.protocol}://${request.get('host')}`;
    if (request.get('X-GC-Request') !== '1'
        || (request.get('origin') && request.get('origin') !== expectedOrigin)) {
      return response.status(403).json({ error: 'cross_site_request_rejected' });
    }
    next();
  }

  async function findSession(request) {
    const token = (request.get('cookie') || '').split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const result = await pool.query(`SELECT u.username, u.role FROM gc_auth_sessions s
      JOIN gc_auth_users u ON u.username = s.username
      WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.active = TRUE`, [tokenHash(token)]);
    return result.rows[0] ? { ...result.rows[0], tokenHash: tokenHash(token) } : null;
  }

  router.use(guardWrite);
  router.post('/login', async (request, response) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = request.ip;
    const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (attempt.count >= 10) {
      response.set('Retry-After', String(Math.ceil((attempt.until - now) / 1000)));
      return response.status(429).json({ error: 'login_rate_limited' });
    }
    attempt.count += 1;
    attempts.set(key, attempt);
    const { username, password } = request.body || {};
    if (typeof username !== 'string' || typeof password !== 'string'
        || username.length > 80 || password.length > 1024) {
      return response.status(401).json({ error: 'invalid_credentials' });
    }
    const result = await pool.query('SELECT username, password_hash, role, active FROM gc_auth_users WHERE username = $1', [username]);
    const user = result.rows[0];
    const valid = await verifyPassword(password, user?.password_hash || dummyHash);
    if (!valid || !user?.active) return response.status(401).json({ error: 'invalid_credentials' });
    attempts.delete(key);
    const previous = await findSession(request);
    if (previous) await pool.query('DELETE FROM gc_auth_sessions WHERE token_hash = $1', [previous.tokenHash]);
    await pool.query('DELETE FROM gc_auth_sessions WHERE expires_at <= NOW()');
    const token = randomBytes(32).toString('hex');
    await pool.query(`INSERT INTO gc_auth_sessions (token_hash, username, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '8 hours')`, [tokenHash(token), user.username]);
    response.cookie(cookieName, token, {
      httpOnly: true, sameSite: 'strict', secure: request.secure, maxAge: sessionSeconds * 1000, path: '/',
    });
    response.set('Cache-Control', 'no-store');
    response.json({ username: user.username, role: user.role });
  });

  router.get('/session', async (request, response) => {
    response.set('Cache-Control', 'no-store');
    const user = await findSession(request);
    if (!user) return response.status(401).json({ error: 'authentication_required' });
    response.json({ username: user.username, role: user.role });
  });

  router.post('/logout', async (request, response) => {
    const user = await findSession(request);
    if (user) await pool.query('DELETE FROM gc_auth_sessions WHERE token_hash = $1', [user.tokenHash]);
    response.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: request.secure, path: '/' });
    response.sendStatus(204);
  });

  async function authorize(request, response, next) {
    try {
      response.set('Cache-Control', 'no-store');
      const user = await findSession(request);
      if (!user) return response.status(401).json({ error: 'authentication_required' });
      if (!canAccess(user.role, request.method, request.path)) return response.status(403).json({ error: 'role_forbidden' });
      request.user = { username: user.username, role: user.role };
      guardWrite(request, response, next);
    } catch (error) {
      next(error);
    }
  }

  return { router, authorize };
}