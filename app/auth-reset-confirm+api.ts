import { logApiFailure } from '@/utils/apiLogging';
import {
  MAX_CODE_ATTEMPTS,
  SESSION_TTL_MS,
  digest,
  generateSessionToken,
  hashPassword,
  isRateLimited,
  isValidEmail,
  normaliseEmail,
  supabaseQuery,
} from '@/utils/authServer';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

type ResetRow = {
  email: string;
  code_hash: string;
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
  if (isRateLimited(request, 'reset-confirm', 10)) {
    return json({ error: 'Túl sok próbálkozás. Várj egy percet.' }, 429);
  }

  let body: { email?: unknown; code?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Hibás kérés.' }, 400);
  }

  const email = normaliseEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return json({ error: 'Hibás kód.' }, 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json(
      { error: `A jelszó legyen legalább ${MIN_PASSWORD_LENGTH} karakter.` },
      400,
    );
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return json({ error: 'Ez a jelszó túl hosszú.' }, 400);
  }

  try {
    const [pending] = await supabaseQuery<ResetRow>('app_reset_codes', {
      query: `email=eq.${encodeURIComponent(email)}&select=*`,
      returning: true,
    });

    if (!pending) {
      return json({ error: 'Nincs érvényes kód. Kérj újat.' }, 404);
    }
    if (new Date(pending.expires_at).getTime() < Date.now()) {
      return json({ error: 'A kód lejárt. Kérj újat.' }, 410);
    }
    if (pending.attempts >= MAX_CODE_ATTEMPTS) {
      return json({ error: 'Túl sok hibás kód. Kérj új kódot.' }, 429);
    }

    if (digest(code) !== pending.code_hash) {
      await supabaseQuery('app_reset_codes', {
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

    const [user] = await supabaseQuery<{ id: string; email: string }>(
      'app_users',
      {
        method: 'PATCH',
        query: `email=eq.${encodeURIComponent(email)}`,
        returning: true,
        body: {
          password_hash: await hashPassword(password),
          last_login_at: new Date().toISOString(),
        },
      },
    );

    if (!user) return json({ error: 'Nincs ilyen fiók.' }, 404);

    // Every existing session goes. A reset is what you do when someone else
    // may have had the password, so leaving their sessions alive would defeat
    // the point of resetting it.
    await supabaseQuery('app_sessions', {
      method: 'DELETE',
      query: `user_id=eq.${user.id}`,
    });

    const token = generateSessionToken();
    await supabaseQuery('app_sessions', {
      method: 'POST',
      body: {
        token_hash: digest(token),
        user_id: user.id,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      },
    });

    await supabaseQuery('app_reset_codes', {
      method: 'DELETE',
      query: `email=eq.${encodeURIComponent(email)}`,
    });

    return json({ token, email: user.email });
  } catch (error) {
    logApiFailure('auth-reset-confirm', error);
    return json(
      { error: 'A visszaállítás most nem érhető el. Próbáld újra később.' },
      502,
    );
  }
}
