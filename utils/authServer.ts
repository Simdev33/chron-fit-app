import {
  createHash,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Server-only helpers for the auth routes. Nothing here may be imported from a
 * component: it reads the service role key, which bypasses row level security
 * and must never reach the client bundle.
 */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;

export const CODE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

function scryptAsync(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (error, derived) => (error ? reject(error) : resolve(derived)),
    );
  });
}

/** "scrypt$N$r$p$salt$hash" -- self describing, so the cost can change later. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt);
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'base64');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      Buffer.from(salt, 'base64'),
      expected.length,
      { N: Number(n), r: Number(r), p: Number(p) },
      (error, value) => (error ? reject(error) : resolve(value)),
    );
  });

  // Constant time, so the comparison itself does not leak the hash.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Six digits rather than letters: it is typed on a phone keypad, and digits
 * remove any question of case or of 0 versus O.
 */
export function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Codes and session tokens are high entropy already, so a plain SHA-256 is
 * enough to keep the readable value out of the database -- unlike a password,
 * there is nothing here to brute force.
 */
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function generateSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function normaliseEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

export function supabaseConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

type QueryOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** e.g. "email=eq.a%40b.hu&select=*" */
  query?: string;
  /** Ask PostgREST to return the affected rows. */
  returning?: boolean;
  /** For upserts: which column resolves the conflict. */
  onConflict?: string;
};

/**
 * PostgREST over plain fetch. supabase-js is not used anywhere in this project
 * because it fails to bundle under Metro, and these routes need nothing it
 * offers beyond a request.
 */
export async function supabaseQuery<T>(
  table: string,
  options: QueryOptions = {},
): Promise<T[]> {
  const config = supabaseConfig();
  if (!config) throw new Error('supabase-not-configured');

  const {
    method = 'GET',
    body,
    query = '',
    returning,
    onConflict,
  } = options;

  const params = [query, onConflict ? `on_conflict=${onConflict}` : '']
    .filter(Boolean)
    .join('&');

  const prefer: string[] = [];
  if (returning) prefer.push('return=representation');
  else prefer.push('return=minimal');
  if (onConflict) prefer.push('resolution=merge-duplicates');

  const response = await fetch(
    `${config.url}/rest/v1/${table}${params ? `?${params}` : ''}`,
    {
      method,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        Prefer: prefer.join(','),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );

  if (!response.ok) {
    // The body can quote the row, which for these tables means a hash.
    throw new Error(`supabase-${response.status}`);
  }
  if (!returning) return [];
  return (await response.json()) as T[];
}

/* ------------------------------------------------------------------ */
/* Resend                                                              */
/* ------------------------------------------------------------------ */

export async function sendVerificationEmail(email: string, code: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('resend-not-configured');

  const from = process.env.RESEND_FROM || 'CrohnSync <onboarding@resend.dev>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} — a CrohnSync megerősítő kódod`,
      text: [
        'Szia!',
        '',
        `A CrohnSync regisztrációdhoz tartozó kód: ${code}`,
        '',
        'A kód 10 percig érvényes. Ha nem te kérted, hagyd figyelmen kívül ezt a levelet — enélkül a fiók nem jön létre.',
      ].join('\n'),
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1A0D35">
          <h1 style="font-size:18px;margin:0 0 16px">A megerősítő kódod</h1>
          <p style="font-size:14px;line-height:20px;margin:0 0 20px;color:#4b3b6b">
            Írd be ezt a kódot a CrohnSync alkalmazásban:
          </p>
          <div style="font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;padding:16px;background:#F5F0FF;border-radius:12px;color:#6D28D9">
            ${code}
          </div>
          <p style="font-size:12px;line-height:18px;margin:20px 0 0;color:#7c6a9c">
            A kód 10 percig érvényes. Ha nem te kérted, hagyd figyelmen kívül
            ezt a levelet — enélkül a fiók nem jön létre.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`resend-${response.status}`);
  }
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(
  request: Request,
  scope: string,
  limit: number,
  windowMs = 60_000,
) {
  const id =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const key = `${scope}:${id}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}
