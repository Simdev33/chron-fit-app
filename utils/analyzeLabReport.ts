import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { LabAnalyzeResponse } from '@/app/analyze-lab+api';
import {
  pickMedicalPdf,
  pickMedicalPhoto,
  type PickedMedicalFile,
} from '@/utils/pickMedicalFile';

const REQUEST_TIMEOUT_MS = 60_000;

// Picking is identical for lab reports and other medical documents; keeping it
// in one place means fixes like the data-URL strip only have to happen once.
export const pickLabPhoto = pickMedicalPhoto;
export const pickLabPdf = pickMedicalPdf;
export type PickedLabFile = PickedMedicalFile;

function getAnalyzeEndpoint() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configuredBaseUrl) return `${configuredBaseUrl}/analyze-lab`;

  if (Platform.OS === 'web') return '/analyze-lab';

  const developmentHost = Constants.expoConfig?.hostUri;
  if (__DEV__ && developmentHost) {
    return `http://${developmentHost}/analyze-lab`;
  }

  throw new Error(
    'Native production builds require EXPO_PUBLIC_API_URL to read lab reports.',
  );
}

export type LabAnalysis = Exclude<LabAnalyzeResponse, { error: string }>;

export async function analyzeLabReport(
  file: PickedMedicalFile,
): Promise<LabAnalysis> {
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
    const result = (await response.json()) as LabAnalyzeResponse;

    if (!response.ok || !('values' in result)) {
      throw new Error(
        'error' in result ? result.error : 'Nem sikerült kiolvasni a leletet.',
      );
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A leletbeolvasás túl sokáig tartott. Próbáld újra.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
