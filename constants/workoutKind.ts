import type { WorkoutDayKind } from '@/types/workoutPlan';

/**
 * Shared by the calendar and the day card. They import each other, so these
 * live apart from both rather than in whichever one happened to define them.
 */
export const KIND_COLOR: Record<WorkoutDayKind, string> = {
  strength: '#A78BFA',
  cardio: '#F472B6',
  'active-rest': '#34D399',
  rest: 'rgba(148,163,184,0.7)',
};

export const KIND_LABEL: Record<WorkoutDayKind, string> = {
  strength: 'Súlyzós',
  cardio: 'Kardió',
  'active-rest': 'Aktív pihenő',
  rest: 'Pihenőnap',
};
