import {
  isMedicationDueOn,
  medicationDoseKey,
  toIsoDate,
  type HealthLog,
} from '@/context/HealthLogContext';

export type DailyTaskKind = 'medication' | 'journal' | 'workout';

export type DailyTask = {
  id: string;
  kind: DailyTaskKind;
  label: string;
  done: boolean;
};

export type DailyProgress = {
  tasks: DailyTask[];
  done: number;
  total: number;
  /** 0-1. One when there is nothing left, including when there was nothing. */
  ratio: number;
  /** The first thing still outstanding, for the card to point at. */
  next: DailyTask | null;
};

/**
 * What the day actually asks of the user, gathered from the log rather than
 * from a fixed checklist -- someone on no medication should not be shown a
 * bar that can never fill.
 */
export function computeDailyProgress(
  log: HealthLog,
  now: Date,
): DailyProgress {
  const todayIso = toIsoDate(now);
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const yesterdayIso = toIsoDate(yesterday);
  const takenToday = log.takenDoses?.[todayIso] ?? [];

  const tasks: DailyTask[] = [];

  log.medications
    .filter(
      (medication) =>
        medication.times.length > 0 && isMedicationDueOn(medication, now),
    )
    .forEach((medication) => {
      medication.times.forEach((time) => {
        tasks.push({
          id: medicationDoseKey(medication.id, time),
          kind: 'medication',
          label: `${medication.name} · ${time}`,
          done: takenToday.includes(medicationDoseKey(medication.id, time)),
        });
      });
    });

  const journalDone = (log.symptoms[yesterdayIso] ?? []).some(
    (entry) =>
      entry.journalKind === 'yesterday' ||
      entry.bowelMovements !== undefined ||
      entry.medicationCompliance !== undefined,
  );
  tasks.push({
    id: 'journal',
    kind: 'journal',
    label: 'Tegnapi napló',
    done: journalDone,
  });

  // Only when a plan exists and today is not a rest day; otherwise there is
  // nothing to tick and the bar would be unfair.
  const weekday = (now.getDay() + 6) % 7;
  const plannedToday = log.workoutPlan?.days.find(
    (day) => day.weekday === weekday && day.kind !== 'rest',
  );
  if (plannedToday) {
    tasks.push({
      id: plannedToday.id,
      kind: 'workout',
      label: plannedToday.title,
      done: (log.completedWorkouts[todayIso] ?? []).some(
        (entry) => entry.planDayId === plannedToday.id,
      ),
    });
  }

  const done = tasks.filter((task) => task.done).length;
  const total = tasks.length;

  return {
    tasks,
    done,
    total,
    ratio: total === 0 ? 1 : done / total,
    next: tasks.find((task) => !task.done) ?? null,
  };
}
