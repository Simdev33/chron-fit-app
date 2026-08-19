import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type {
  DocumentAnalyzeResponse,
  DocumentFindings,
} from '@/app/analyze-document+api';
import type { PickedMedicalFile } from '@/utils/pickMedicalFile';

const REQUEST_TIMEOUT_MS = 90_000;

function getAnalyzeEndpoint() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configuredBaseUrl) return `${configuredBaseUrl}/analyze-document`;

  if (Platform.OS === 'web') return '/analyze-document';

  const developmentHost = Constants.expoConfig?.hostUri;
  if (__DEV__ && developmentHost) {
    return `http://${developmentHost}/analyze-document`;
  }

  throw new Error(
    'Native production builds require EXPO_PUBLIC_API_URL to read documents.',
  );
}

export type { DocumentFindings };

export async function analyzeDocument(
  file: PickedMedicalFile,
): Promise<DocumentFindings> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getAnalyzeEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64: file.base64,
        mimeType: file.mimeType,
      }),
      signal: controller.signal,
    });
    const result = (await response.json()) as DocumentAnalyzeResponse;

    if (!response.ok || 'error' in result) {
      throw new Error(
        'error' in result
          ? result.error
          : 'Nem sikerült feldolgozni a dokumentumot.',
      );
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A feldolgozás túl sokáig tartott. Próbáld újra.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
