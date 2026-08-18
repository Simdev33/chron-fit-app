import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  FloraChatMessage,
  FloraChatRequest,
  FloraChatResponse,
} from '@/types/floraChat';

const REQUEST_TIMEOUT_MS = 30_000;
const TIMEOUT_RETRIES = 1;

function getChatEndpoint() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configuredBaseUrl) return `${configuredBaseUrl}/flora-chat`;

  if (Platform.OS === 'web') return '/flora-chat';

  const developmentHost = Constants.expoConfig?.hostUri;
  if (__DEV__ && developmentHost) {
    return `http://${developmentHost}/flora-chat`;
  }

  throw new Error(
    'Native production builds require EXPO_PUBLIC_API_URL to reach Flora.',
  );
}

async function postFloraRequest(body: FloraChatRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getChatEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = (await response.json()) as FloraChatResponse;

    if (!response.ok || !('reply' in result)) {
      throw new Error(
        'error' in result ? result.error : 'Flóra nem tudott válaszolni.',
      );
    }

    return result.reply;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestFloraReply(messages: FloraChatMessage[]) {
  const recentMessages = messages.slice(-20);
  const firstUserIndex = recentMessages.findIndex(
    (message) => message.role === 'user',
  );
  const body: FloraChatRequest = {
    messages: recentMessages
      .slice(Math.max(firstUserIndex, 0))
      .map(({ role, text }) => ({ role, text })),
  };

  // A timeout is nearly always a one-off latency spike, so give it one more
  // try before showing an error. Everything else (missing key, refused topic,
  // bad response) is deterministic — retrying those would only add delay.
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await postFloraRequest(body);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      if (!timedOut) throw error;
      if (attempt >= TIMEOUT_RETRIES) {
        throw new Error('Flóra válasza túl sokáig tartott. Próbáld újra.');
      }
    }
  }
}
