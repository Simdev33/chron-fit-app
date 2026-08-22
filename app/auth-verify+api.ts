import { logApiFailure } from '@/utils/apiLogging';
import {
  MAX_CODE_ATTEMPTS,
  SESSION_TTL_MS,
  digest,
  generateSessionToken,
  isRateLimited,
  isValidEmail,
  normaliseEmail,
  supabaseQuery,
} from '@/utils/authServer';

type PendingRow = {
  email: string;
  code_hash: string;
  password_hash: string;
  expires_at: string;
  attempts: number;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  if (isRateLimited(request, 'verify', 10)) {
    return json({ error: 'Túl sok próbálkozás. Várj egy percet.' }, 429);
  }

  let body: { email?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Hibás kérés.' }, 400);
  }

  const email = normaliseEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.trim() : '';

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return json({ error: 'Hibás kód.' }, 400);
  }

  try {
    const [pending] = await supabaseQuery<PendingRow>('app_signup_codes', {
      query: `email=eq.${encodeURIComponent(email)}&select=*`,
      returning: true,
    });

    if (!pending) {
      return json(
        { error: 'Nincs függőben lévő regisztráció. Kérj új kódot.' },
        404,
      );
    }
    if (new Date(pending.expires_at).getTime() < Date.now()) {
      return json({ error: 'A kód lejárt. Kérj újat.' }, 410);
    }
    if (pending.attempts >= MAX_CODE_ATTEMPTS) {
      return json(
        { error: 'Túl sok hibás kód. Kérj új kódot.' },
        429,
      );
    }

    if (digest(code) !== pending.code_hash) {
      // Counted server side, so retrying cannot be reset by reinstalling.
      await supabaseQuery('app_signup_codes', {
        method: 'PATCH',
        query: `email=eq.${encodeURIComponent(email)}`,
        body: { attempts: pending.attempts + 1 },
      });
      const left = MAX_CODE_ATTEMPTS - pending.attempts - 1;
      return json(
        {
          error:
            left > 0
              ? `Hibás kód. Még ${left} próbálkozásod van.`
              : 'Hibás kód. Kérj új kódot.',
        },
        401,
      );
    }

    // The password hash travels from the pending row rather than being
    // recomputed: the plain password was never stored, and is not in this
    // request either.
    const [user] = await supabaseQuery<{ id: string; email: string }>(
      'app_users',
      {
        method: 'POST',
        returning: true,
        body: {
          email,
          password_hash: pending.password_hash,
          last_login_at: new Date().toISOString(),
        },
      },
    );

    if (!user) throw new Error('user-not-created');

    const token = generateSessionToken();
    await supabaseQuery('app_sessions', {
      method: 'POST',
      body: {
        token_hash: digest(token),
        user_id: user.id,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      },
    });

    await supabaseQuery('app_signup_codes', {
      method: 'DELETE',
      query: `email=eq.${encodeURIComponent(email)}`,
    });

    return json({ token, email: user.email });
  } catch (error) {
    logApiFailure('auth-verify', error);
    return json(
      { error: 'A megerősítés most nem érhető el. Próbáld újra később.' },
      502,
    );
  }
}
