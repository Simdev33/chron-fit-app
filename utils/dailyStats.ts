import {
  isMedicationDueOn,
  medicationDoseKey,
  toIsoDate,
  type HealthLog,
} from '@/context/HealthLogContext';
import type { Profile } from '@/context/ProfileContext';
import type { WorkoutDayKind } from '@/types/workoutPlan';
import { computeNutritionTargets } from '@/utils/nutritionTargets';

export type StatRow = {
  current: number;
  goal: number;
};

/**
 * Only what the user actually has data for. Every field but the journal is
 * optional, and an absent one means the row is not drawn at all -- a bar that
 * can never fill is worse than no bar.
 */
export type DailyStats = {
  journalDone: boolean;
  medication?: StatRow;
  activeCalories?: StatRow;
  meals?: StatRow;
};

/**
 * Rough metabolic equivalents by session type. Enough to turn a logged
 * duration into a believable figure; it is an estimate, not a measurement,
 * and the app has no heart rate or step data to do better.
 */
const MET: Record<WorkoutDayKind, number> = {
  strength: 5,
  cardio: 7,
  'active-rest': 3,
  rest: 0,
};

function burnedKcal(
  kind: WorkoutDayKind,
  minutes: number,
  weightKg: number,
) {
  return Math.round(MET[kind] * weightKg * (minutes / 60));
}

export function computeDailyStats(
  log: HealthLog,
  profile: Profile,
  now: Date,
): DailyStats {
  const todayIso = toIsoDate(now);
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const yesterdayIso = toIsoDate(yesterday);

  const journalDone = (log.symptoms[yesterdayIso] ?? []).some(
    (entry) =>
      entry.journalKind === 'yesterday' ||
      entry.bowelMovements !== undefined ||
      entry.medicationCompliance !== undefined,
  );

  const stats: DailyStats = { journalDone };

  // Medication -- only when something is actually due today.
  const takenToday = log.takenDoses?.[todayIso] ?? [];
  let dueTotal = 0;
  let dueDone = 0;
  log.medications
    .filter(
      (medication) =>
        medication.times.length > 0 && isMedicationDueOn(medication, now),
    )
    .forEach((medication) => {
      medication.times.forEach((time) => {
        dueTotal += 1;
        if (takenToday.includes(medicationDoseKey(medication.id, time))) {
          dueDone += 1;
        }
      });
    });
  if (dueTotal > 0) stats.medication = { current: dueDone, goal: dueTotal };

  // Active calories -- measured against what today's plan asks for, so
  // finishing the planned session reads as done rather than against some
  // invented daily figure.
  const weight = Number(String(profile.weightKg).replace(',', '.'));
  if (Number.isFinite(weight) && weight > 0) {
    const weekday = (now.getDay() + 6) % 7;
    const plannedToday = log.workoutPlan?.days.find(
      (day) => day.weekday === weekday && day.kind !== 'rest',
    );
    const doneToday = log.completedWorkouts[todayIso] ?? [];

    const current = doneToday.reduce(
      (sum, entry) =>
        sum + burnedKcal(entry.kind, entry.durationMin ?? 0, weight),
      0,
    );
    const planned = plannedToday
      ? burnedKcal(plannedToday.kind, plannedToday.durationMin ?? 0, weight)
      : 0;

    // With nothing planned, whatever was done is the whole of it.
    const goal = planned > 0 ? planned : current;
    if (goal > 0) stats.activeCalories = { current, goal };
  }

  // Meals -- only once something has been logged today and a target exists.
  const meals = log.meals[todayIso] ?? [];
  const targets = computeNutritionTargets(profile);
  if (meals.length > 0 && targets) {
    stats.meals = {
      current: meals.reduce((sum, meal) => sum + (meal.calories ?? 0), 0),
      goal: targets.calories,
    };
  }

  return stats;
}
