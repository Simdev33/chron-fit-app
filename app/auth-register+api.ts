import { logApiFailure } from '@/utils/apiLogging';
import {
  CODE_TTL_MS,
  digest,
  generateCode,
  hashPassword,
  isRateLimited,
  isValidEmail,
  normaliseEmail,
  sendVerificationEmail,
  supabaseQuery,
} from '@/utils/authServer';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  // Deliberately tight: every call sends an email.
  if (isRateLimited(request, 'register', 5)) {
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

  if (!isValidEmail(email)) {
    return json({ error: 'Adj meg egy érvényes email címet.' }, 400);
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
    const existing = await supabaseQuery<{ id: string }>('app_users', {
      query: `email=eq.${encodeURIComponent(email)}&select=id`,
      returning: true,
    });
    if (existing.length > 0) {
      return json(
        { error: 'Ezzel az email címmel már van fiók. Jelentkezz be.' },
        409,
      );
    }

    const code = generateCode();

    // The account is not created yet. Everything waits here until the code
    // comes back, so an unconfirmed address never occupies an email.
    await supabaseQuery('app_signup_codes', {
      method: 'POST',
      onConflict: 'email',
      body: {
        email,
        code_hash: digest(code),
        password_hash: await hashPassword(password),
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        attempts: 0,
      },
    });

    await sendVerificationEmail(email, code);
    return json({ sent: true });
  } catch (error) {
    logApiFailure('auth-register', error);
    return json(
      { error: 'A regisztráció most nem érhető el. Próbáld újra később.' },
      502,
    );
  }
}
