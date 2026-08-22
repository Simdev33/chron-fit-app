import Constants from 'expo-constants';
import { Platform } from 'react-native';

const REQUEST_TIMEOUT_MS = 30_000;

function endpoint(route: string) {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configuredBaseUrl) return `${configuredBaseUrl}/${route}`;

  if (Platform.OS === 'web') return `/${route}`;

  const developmentHost = Constants.expoConfig?.hostUri;
  if (__DEV__ && developmentHost) return `http://${developmentHost}/${route}`;

  throw new Error(
    'Native production builds require EXPO_PUBLIC_API_URL to sign in.',
  );
}

async function post<T>(route: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint(route), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      throw new Error(result?.error ?? 'A művelet nem sikerült.');
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A kérés túl sokáig tartott. Próbáld újra.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export type AuthSession = { token: string; email: string };

/** Sends the six digit code. The account is created only once it comes back. */
export function requestSignupCode(email: string, password: string) {
  return post<{ sent: true }>('auth-register', { email, password });
}

export function verifySignupCode(email: string, code: string) {
  return post<AuthSession>('auth-verify', { email, code });
}

export function login(email: string, password: string) {
  return post<AuthSession>('auth-login', { email, password });
}

/**
 * Answers the same whether or not the address has an account, so the reply
 * cannot be used to find out who is a user here.
 */
export function requestPasswordReset(email: string) {
  return post<{ sent: true }>('auth-reset-request', { email });
}

export function confirmPasswordReset(
  email: string,
  code: string,
  password: string,
) {
  return post<AuthSession>('auth-reset-confirm', { email, code, password });
}
