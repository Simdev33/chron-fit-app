import { logApiFailure } from '@/utils/apiLogging';
import {
  CODE_TTL_MS,
  digest,
  generateCode,
  isRateLimited,
  isValidEmail,
  normaliseEmail,
  sendVerificationEmail,
  supabaseQuery,
} from '@/utils/authServer';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  if (isRateLimited(request, 'reset-request', 5)) {
    return json({ error: 'Túl sok próbálkozás. Várj egy percet.' }, 429);
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Hibás kérés.' }, 400);
  }

  const email = normaliseEmail(body.email);
  if (!isValidEmail(email)) {
    return json({ error: 'Adj meg egy érvényes email címet.' }, 400);
  }

  try {
    const [user] = await supabaseQuery<{ id: string }>('app_users', {
      query: `email=eq.${encodeURIComponent(email)}&select=id`,
      returning: true,
    });

    if (user) {
      const code = generateCode();
      await supabaseQuery('app_reset_codes', {
        method: 'POST',
        onConflict: 'email',
        body: {
          email,
          code_hash: digest(code),
          expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
          attempts: 0,
        },
      });
      await sendVerificationEmail(email, code, 'reset');
    }

    // The same answer either way. Unlike registration, saying nothing costs
    // the user nothing here -- and confirming that an address has an account
    // in this app would say something about that person's health.
    return json({ sent: true });
  } catch (error) {
    logApiFailure('auth-reset-request', error);

    const detail = error instanceof Error ? error.message : '';
    if (detail.startsWith('resend-403')) {
      return json(
        {
          error:
            process.env.NODE_ENV === 'production'
              ? 'Erre a címre most nem tudunk levelet küldeni.'
              : `A Resend elutasította a küldést: ${detail.slice(0, 300)}`,
        },
        502,
      );
    }

    return json(
      { error: 'A visszaállítás most nem érhető el. Próbáld újra később.' },
      502,
    );
  }
}
