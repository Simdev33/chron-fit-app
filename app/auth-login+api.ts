import { logApiFailure } from '@/utils/apiLogging';
import {
  SESSION_TTL_MS,
  digest,
  generateSessionToken,
  isRateLimited,
  isValidEmail,
  normaliseEmail,
  supabaseQuery,
  verifyPassword,
} from '@/utils/authServer';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  if (isRateLimited(request, 'login', 10)) {
    return json({ error: 'Túl sok próbálkozás. Várj egy percet.' }, 429);
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Hibás kérés.' }, 400);
  }

  const email = normaliseEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email) || !password) {
    return json({ error: 'Hibás email cím vagy jelszó.' }, 401);
  }

  try {
    const [user] = await supabaseQuery<UserRow>('app_users', {
      query: `email=eq.${encodeURIComponent(email)}&select=id,email,password_hash`,
      returning: true,
    });

    // One message for both cases, so the response cannot be used to find out
    // which addresses have an account -- and here that would say something
    // about the person's health.
    const ok = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !ok) {
      return json({ error: 'Hibás email cím vagy jelszó.' }, 401);
    }

    const token = generateSessionToken();
    await supabaseQuery('app_sessions', {
      method: 'POST',
      body: {
        token_hash: digest(token),
        user_id: user.id,
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      },
    });

    await supabaseQuery('app_users', {
      method: 'PATCH',
      query: `id=eq.${user.id}`,
      body: { last_login_at: new Date().toISOString() },
    });

    return json({ token, email: user.email });
  } catch (error) {
    logApiFailure('auth-login', error);
    return json(
      { error: 'A bejelentkezés most nem érhető el. Próbáld újra később.' },
      502,
    );
  }
}
