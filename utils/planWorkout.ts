import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { WorkoutPlan, WorkoutPlanResponse } from '@/types/workoutPlan';

/** A whole week takes the model longer than naming a photo. */
const REQUEST_TIMEOUT_MS = 60_000;

function getPlanEndpoint() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (configuredBaseUrl) return `${configuredBaseUrl}/plan-workout`;

  if (Platform.OS === 'web') return '/plan-workout';

  const developmentHost = Constants.expoConfig?.hostUri;
  if (__DEV__ && developmentHost) {
    return `http://${developmentHost}/plan-workout`;
  }

  throw new Error(
    'Native production builds require EXPO_PUBLIC_API_URL to plan workouts.',
  );
}

export async function planWorkout(
  prompt: string,
  context?: string,
): Promise<WorkoutPlan> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getPlanEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context }),
      signal: controller.signal,
    });
    const result = (await response.json()) as WorkoutPlanResponse;

    if (!response.ok || !('days' in result)) {
      throw new Error(
        'error' in result ? result.error : 'Nem sikerült tervet készíteni.',
      );
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A tervezés túl sokáig tartott. Próbáld újra.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
