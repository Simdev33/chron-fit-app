import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { LabAnalyzeResponse } from '@/app/analyze-lab+api';

const REQUEST_TIMEOUT_MS = 60_000;
/** Larger than the meal photo: small print has to stay readable. */
const MAX_EDGE_PX = 1_600;
const JPEG_QUALITY = 0.75;

export type PickedLabFile = {
  base64: string;
  mimeType: 'image/jpeg' | 'application/pdf';
  source: 'photo' | 'pdf';
  /** Only set for photos, so the review screen can show a thumbnail. */
  previewUri?: string;
};

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

/** Returns null when the user backs out or denies permission. */
export async function pickLabPhoto(
  source: 'camera' | 'library',
): Promise<PickedLabFile | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.uri) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  const longestEdge = Math.max(asset.width || 0, asset.height || 0);
  if (longestEdge > MAX_EDGE_PX) {
    const portrait = (asset.height || 0) >= (asset.width || 0);
    context.resize(portrait ? { height: MAX_EDGE_PX } : { width: MAX_EDGE_PX });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });

  if (!saved.base64) return null;
  return {
    base64: saved.base64,
    mimeType: 'image/jpeg',
    source: 'photo',
    previewUri: saved.uri,
  };
}

export async function pickLabPdf(): Promise<PickedLabFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.uri) return null;

  // The picker only hands back base64 on web; elsewhere we read the file.
  const base64 = asset.base64 ?? (await new File(asset.uri).base64());
  if (!base64) return null;

  return { base64, mimeType: 'application/pdf', source: 'pdf' };
}

export type LabAnalysis = Exclude<LabAnalyzeResponse, { error: string }>;

export async function analyzeLabReport(
  file: PickedLabFile,
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
