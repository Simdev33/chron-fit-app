import type {
  ExerciseTracking,
  PlannedExercise,
  WorkoutDayKind,
} from '@/types/workoutPlan';

const DURATION_HINT = /\b(perc|min|másodperc|mp)\b/i;

/**
 * Plans stored before the model started saying what to track have no `track`
 * field, and the model can still leave it off. Reading the exercise is a
 * decent stand-in: "15-20 perc" is plainly a duration, and nothing on a
 * mobility day is going to be loaded with weight.
 */
export function resolveTracking(
  exercise: Pick<PlannedExercise, 'name' | 'reps' | 'track'>,
  kind: WorkoutDayKind,
): ExerciseTracking {
  if (exercise.track) return exercise.track;
  if (DURATION_HINT.test(exercise.reps) || DURATION_HINT.test(exercise.name)) {
    return 'duration';
  }
  if (kind === 'cardio') return 'duration';
  if (kind === 'strength') return 'reps-weight';
  return 'reps';
}
