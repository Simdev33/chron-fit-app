import Constants from 'expo-constants';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { MealPhotoAnalysis, MealPhotoResponse } from '@/types/mealPhoto';

const REQUEST_TIMEOUT_MS = 45_000;
/**
 * A phone photo is several megabytes; sending it whole would be slow and
 * costly for no gain. The model only needs enough detail to name the dish.
 */
const MAX_EDGE_PX = 768;
const JPEG_QUALITY = 0.6;

function getAnalyzeEndpoint() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configuredBaseUrl) return `${configuredBaseUrl}/analyze-meal`;

  if (Platform.OS === 'web') return '/analyze-meal';

  const developmentHost = Constants.expoConfig?.hostUri;
  if (__DEV__ && developmentHost) {
    return `http://${developmentHost}/analyze-meal`;
  }

  throw new Error(
    'Native production builds require EXPO_PUBLIC_API_URL to analyse photos.',
  );
}

export type PickedPhoto = { uri: string; base64: string };

/** Returns null when the user backs out or denies permission. */
export async function pickMealPhoto(
  source: 'camera' | 'library',
): Promise<PickedPhoto | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    allowsEditing: true,
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
    context.resize(
      portrait ? { height: MAX_EDGE_PX } : { width: MAX_EDGE_PX },
    );
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });

  if (!saved.base64) return null;
  return { uri: saved.uri, base64: saved.base64 };
}

export async function analyzeMealPhoto(
  imageBase64: string,
): Promise<MealPhotoAnalysis> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getAnalyzeEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
      signal: controller.signal,
    });
    const result = (await response.json()) as MealPhotoResponse;

    if (!response.ok || !('recognized' in result)) {
      throw new Error(
        'error' in result ? result.error : 'Nem sikerült elemezni a képet.',
      );
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A képelemzés túl sokáig tartott. Próbáld újra.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
