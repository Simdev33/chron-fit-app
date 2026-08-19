import type { Portion } from '@/context/HealthLogContext';

export type MealPhotoRequest = {
  /** JPEG image, base64 encoded, without the data: prefix. */
  imageBase64: string;
};

export type MealPhotoAnalysis = {
  /** False when the picture does not show food we can name. */
  recognized: boolean;
  /** Hungarian dish name, e.g. "Sült lazac rizzsel". */
  name: string;
  /** Estimated calories for the portion visible in the photo. */
  calories: number;
  /** How large the visible portion looks. */
  portion: Portion;
};

export type MealPhotoResponse = MealPhotoAnalysis | { error: string };
