import type {
  PlannedDay,
  WorkoutDayKind,
  WorkoutPlan,
} from '@/types/workoutPlan';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type FoodImpact = 'good' | 'bloated' | 'painful';

export type FoodImpactEntry = {
  mealId: string;
  impact: FoodImpact;
};

export type SymptomEntry = {
  id: string;
  time: string; // "HH:MM"
  pain: number; // 0-10
  bristol: number | null; // 1-7
  blood: boolean;
  bowelMovements?: number;
  energy?: number; // 1-5
  medicationCompliance?: 'yes' | 'partial' | 'no' | null;
  medicationMissReason?: 'forgot' | 'left-home' | 'ran-out' | 'unknown' | null;
  foodImpacts?: FoodImpactEntry[];
  journalKind?: 'yesterday';
  note: string;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Portion = 'small' | 'medium' | 'large';

/** Grams of each macro in a portion. Absent on meals logged before these. */
export type MealMacros = {
  carbsG?: number;
  proteinG?: number;
  fatG?: number;
  fiberG?: number;
};

export type MealEntry = MealMacros & {
  id: string;
  time: string; // "HH:MM"
  name: string;
  portion: Portion;
  mealType: MealType;
  calories: number;
  impact?: FoodImpact;
  tagged?: boolean;
};

/** How a measured value sits against the range the lab printed. */
export type LabStatus = 'normal' | 'low' | 'high' | 'unknown';

export type LabValue = {
  /** Analyte name exactly as the report spells it. */
  name: string;
  value: number;
  unit: string;
  /** Bounds copied from the report, not from any built-in table. */
  refLow?: number;
  refHigh?: number;
  /** The range as printed, kept so the user can check what we read. */
  refRange?: string;
  status: LabStatus;
};

export type LabReportEntry = {
  id: string;
  /** ISO date of the sample, or of the import when the report has none. */
  date: string;
  values: LabValue[];
  /** Where the entry came from, for the user's own record. */
  source: 'photo' | 'pdf' | 'manual';
};

export type AppointmentEntry = {
  id: string;
  doctor: string; // orvos vagy intézmény
  exam: string; // vizsgálat / szakterület
  date: string; // ISO dátum (YYYY-MM-DD)
  time: string; // "HH:MM"
  allDay?: boolean;
  medicationId?: string;
};

/** Milyen napokon esedékes. Hiánya napi szedést jelent. */
export type MedicationSchedule =
  | { kind: 'daily' }
  | { kind: 'weekly'; weekday: number }
  | { kind: 'monthly'; monthDay: number };

export type MedicationEntry = {
  id: string;
  name: string;
  dose: string;
  type: 'pill' | 'supplement' | 'biologic';
  times: string[];
  schedule?: MedicationSchedule;
  /** refillThreshold 0 esetén nem követjük a készletet. */
  inventoryRemaining: number;
  refillThreshold: number;
  since: string;
  administrationLocation?: 'home' | 'hospital';
  intervalMonths?: 1 | 2 | 3;
  lastDoseDate?: string;
  nextDoseDate?: string;
};

/** A logged set for one exercise, as the user typed it. */
export type ExerciseResult = {
  exerciseId: string;
  name: string;
  reps: string;
  weightKg: string;
  /** Only meaningful where the exercise is timed rather than counted. */
  minutes: string;
};

/** A day the user marked as done, kept per date so the calendar can read it. */
export type CompletedWorkout = {
  id: string;
  /** Which planned day this came from, when it came from the plan at all. */
  planDayId?: string;
  title: string;
  kind: WorkoutDayKind;
  durationMin?: number;
  results: ExerciseResult[];
};

type HealthLog = {
  /** ISO dátum (YYYY-MM-DD) → hangulat 1-5 */
  moods: Record<string, number>;
  /** ISO dátum → aznapi tünetbejegyzések */
  symptoms: Record<string, SymptomEntry[]>;
  /** ISO dátum → aznapi étkezések */
  meals: Record<string, MealEntry[]>;
  /** Orvosi időpontok */
  appointments: AppointmentEntry[];
  /** Gyógyszerek és kiegészítők */
  medications: MedicationEntry[];
  /** A felhasználó jelezte, hogy nem szed gyógyszert. */
  noMeds: boolean;
  /** ISO dátum → aznap bevett gyógyszer-azonosítók */
  takenDoses: Record<string, string[]>;
  /** Beolvasott laborleletek, legfrissebb elöl. */
  labReports: LabReportEntry[];
  /** A legutóbb generált heti edzésterv, vagy null. */
  workoutPlan: WorkoutPlan | null;
  /** Amit a felhasználó a tervhez beírt, gyakorlatonként. */
  exerciseLog: Record<
    string,
    { reps: string; weightKg: string; minutes: string }
  >;
  /** ISO dátum → aznap elvégzettnek jelölt edzések */
  completedWorkouts: Record<string, CompletedWorkout[]>;
};

const STORAGE_KEY = 'crohnsync-healthlog-v1';

const seedMedications: MedicationEntry[] = [
  {
    id: 'med-1',
    name: 'Mesalamine',
    dose: '800mg',
    type: 'pill',
    times: ['08:00'],
    inventoryRemaining: 4,
    refillThreshold: 5,
    since: '2024-01-15',
  },
  {
    id: 'med-2',
    name: 'Kreatin-monohidrát',
    dose: '5g',
    type: 'supplement',
    times: ['08:00'],
    inventoryRemaining: 30,
    refillThreshold: 7,
    since: '2026-05-01',
  },
  {
    id: 'med-3',
    name: 'Tejsavó izolátum',
    dose: '30g',
    type: 'supplement',
    times: ['20:00'],
    inventoryRemaining: 15,
    refillThreshold: 5,
    since: '2026-06-10',
  },
];

function normalizeSchedule(raw: unknown): MedicationSchedule | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  if (value.kind === 'weekly' && Number.isFinite(Number(value.weekday))) {
    return { kind: 'weekly', weekday: Number(value.weekday) };
  }
  if (value.kind === 'monthly' && Number.isFinite(Number(value.monthDay))) {
    return { kind: 'monthly', monthDay: Number(value.monthDay) };
  }
  return value.kind === 'daily' ? { kind: 'daily' } : undefined;
}

function normalizeMedications(raw: unknown): MedicationEntry[] {
  if (!Array.isArray(raw)) return seedMedications;
  return raw.flatMap((value, index) => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const name = String(item.name ?? '').trim();
    if (!name) return [];
    const legacyTime = String(item.time ?? '08:00').padStart(5, '0');
    const times = Array.isArray(item.times)
      ? item.times.map(String).filter(Boolean)
      : [legacyTime];
    return [
      {
        id: String(item.id ?? `migrated-${index}-${Date.now()}`),
        name,
        dose: String(item.dose ?? '—'),
        type:
          item.type === 'supplement'
            ? 'supplement'
            : item.type === 'biologic'
              ? 'biologic'
              : 'pill',
        times: times.length > 0 ? times : ['08:00'],
        schedule: normalizeSchedule(item.schedule),
        inventoryRemaining:
          item.type === 'biologic'
            ? 0
            : Math.max(0, Number(item.inventoryRemaining ?? 30)),
        refillThreshold:
          item.type === 'biologic'
            ? 0
            : Math.max(1, Number(item.refillThreshold ?? 5)),
        since: String(item.since ?? ''),
        administrationLocation:
          item.administrationLocation === 'hospital'
            ? 'hospital'
            : item.administrationLocation === 'home'
              ? 'home'
              : undefined,
        intervalMonths:
          item.intervalMonths === 1 ||
          item.intervalMonths === 2 ||
          item.intervalMonths === 3
            ? item.intervalMonths
            : undefined,
        lastDoseDate: item.lastDoseDate
          ? String(item.lastDoseDate)
          : undefined,
        nextDoseDate: item.nextDoseDate
          ? String(item.nextDoseDate)
          : undefined,
      },
    ];
  });
}

/** Esedékes-e ma ez a gyógyszer a saját ütemezése szerint. */
export function isMedicationDueOn(
  medication: MedicationEntry,
  date: Date,
): boolean {
  const schedule = medication.schedule;
  if (!schedule || schedule.kind === 'daily') return true;
  if (schedule.kind === 'weekly') {
    // A hét hétfővel kezdődik, ahogy a felvitel képernyőn.
    const weekday = (date.getDay() + 6) % 7;
    return weekday === schedule.weekday;
  }
  return date.getDate() === schedule.monthDay;
}

export function medicationDoseKey(id: string, time: string): string {
  return `${id}@${time}`;
}

const seedAppointments: AppointmentEntry[] = [
  {
    id: 'seed-1',
    doctor: 'Dr. Kim Sarah',
    exam: 'Gasztroenterológia',
    date: '2026-08-20',
    time: '10:30',
  },
  {
    id: 'seed-2',
    doctor: 'Vérvétel',
    exam: 'CBC · CRP · Kalprotektin',
    date: '2026-08-16',
    time: '8:00',
  },
];

const emptyLog: HealthLog = {
  moods: {},
  symptoms: {},
  meals: {},
  appointments: seedAppointments,
  medications: seedMedications,
  noMeds: false,
  takenDoses: {},
  labReports: [],
  workoutPlan: null,
  exerciseLog: {},
  completedWorkouts: {},
};

/**
 * Derived from the report's own bounds. Anything without a usable range stays
 * 'unknown' rather than being guessed at — the app does not invent thresholds.
 */
export function deriveLabStatus(
  value: number,
  refLow?: number,
  refHigh?: number,
): LabStatus {
  if (!Number.isFinite(value)) return 'unknown';
  const hasLow = Number.isFinite(refLow as number);
  const hasHigh = Number.isFinite(refHigh as number);
  if (!hasLow && !hasHigh) return 'unknown';
  if (hasHigh && value > (refHigh as number)) return 'high';
  if (hasLow && value < (refLow as number)) return 'low';
  return 'normal';
}

export const labStatusLabels: Record<LabStatus, string> = {
  normal: 'Normál',
  low: 'Alacsony',
  high: 'Emelkedett',
  unknown: 'Nincs referencia',
};

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type HealthLogContextValue = {
  ready: boolean;
  log: HealthLog;
  setMoodForToday: (mood: number) => void;
  addLabReport: (entry: Omit<LabReportEntry, 'id'>) => void;
  removeLabReport: (id: string) => void;
  addSymptomForToday: (
    entry: Omit<SymptomEntry, 'id' | 'time'>,
  ) => void;
  addSymptomForDate: (
    date: string,
    entry: Omit<SymptomEntry, 'id' | 'time'>,
  ) => void;
  saveYesterdayJournalForDate: (
    date: string,
    entry: Omit<SymptomEntry, 'id' | 'time'>,
  ) => void;
  addMeal: (
    entry: Omit<MealEntry, 'id' | 'time'>,
    dateIso?: string,
  ) => void;
  removeMeal: (date: string, id: string) => void;
  addAppointment: (entry: Omit<AppointmentEntry, 'id'>) => void;
  removeAppointment: (id: string) => void;
  addMedication: (entry: Omit<MedicationEntry, 'id'>) => void;
  removeMedication: (id: string) => void;
  takeMedicationDose: (id: string, time: string, dateIso?: string) => void;
  /** „Nem szedek gyógyszert” jelző; bekapcsolva a gyógyszerlista is ürül. */
  setNoMeds: (value: boolean) => void;
  /** Onboarding után: üres gyógyszerlista + a noMeds jelző beállítása. */
  resetMedications: (noMeds: boolean) => void;
  /** A frissen generált terv felváltja a korábbit; null törli. */
  saveWorkoutPlan: (plan: WorkoutPlan | null) => void;
  /** Egy gyakorlathoz beírt ismétlés/súly. Üres mezőt is meg kell őrizni. */
  setExerciseResult: (
    exerciseId: string,
    value: { reps: string; weightKg: string; minutes: string },
  ) => void;
  /** A napot elvégzettnek jelöli a megadott dátumon. */
  completeWorkoutDay: (day: PlannedDay, dateIso: string) => void;
  /** Visszavonja a jelölést. */
  uncompleteWorkoutDay: (planDayId: string, dateIso: string) => void;
};

const HealthLogContext = createContext<HealthLogContextValue | null>(null);

export function HealthLogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [log, setLog] = useState<HealthLog>(emptyLog);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<HealthLog>;
          setLog({
            moods: parsed.moods ?? {},
            symptoms: parsed.symptoms ?? {},
            meals: parsed.meals ?? {},
            appointments: parsed.appointments ?? seedAppointments,
            medications: normalizeMedications(parsed.medications),
            noMeds: parsed.noMeds ?? false,
            takenDoses: parsed.takenDoses ?? {},
            // Absent for anyone whose log predates lab imports.
            labReports: parsed.labReports ?? [],
            // Likewise for anyone whose log predates the fitness planner.
            workoutPlan: parsed.workoutPlan ?? null,
            exerciseLog: parsed.exerciseLog ?? {},
            completedWorkouts: parsed.completedWorkouts ?? {},
          });
        }
      } catch {
        // keep empty log
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((updater: (prev: HealthLog) => HealthLog) => {
    setLog((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setMoodForToday = useCallback(
    (mood: number) => {
      const today = toIsoDate(new Date());
      update((prev) => ({
        ...prev,
        moods: { ...prev.moods, [today]: mood },
      }));
    },
    [update],
  );

  const addSymptomForDate = useCallback(
    (date: string, entry: Omit<SymptomEntry, 'id' | 'time'>) => {
      const now = new Date();
      const full: SymptomEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes(),
        ).padStart(2, '0')}`,
      };
      update((prev) => ({
        ...prev,
        symptoms: {
          ...prev.symptoms,
          [date]: [...(prev.symptoms[date] ?? []), full],
        },
      }));
    },
    [update],
  );

  const saveYesterdayJournalForDate = useCallback(
    (date: string, entry: Omit<SymptomEntry, 'id' | 'time'>) => {
      const impacts = new Map(
        (entry.foodImpacts ?? []).map(({ mealId, impact }) => [mealId, impact]),
      );

      update((prev) => {
        const entries = prev.symptoms[date] ?? [];
        const existingIndex = entries.findIndex(
          (item) =>
            item.journalKind === 'yesterday' ||
            item.bowelMovements !== undefined ||
            item.medicationCompliance !== undefined,
        );
        const now = new Date();
        const existing =
          existingIndex >= 0 ? entries[existingIndex] : undefined;
        const full: SymptomEntry = existing
          ? { ...existing, ...entry }
          : {
              ...entry,
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              time: `${String(now.getHours()).padStart(2, '0')}:${String(
                now.getMinutes(),
              ).padStart(2, '0')}`,
            };
        const nextEntries =
          existingIndex >= 0
            ? entries.map((item, index) =>
                index === existingIndex ? full : item,
              )
            : [...entries, full];

        return {
          ...prev,
          symptoms: {
            ...prev.symptoms,
            [date]: nextEntries,
          },
          meals: {
            ...prev.meals,
            [date]: (prev.meals[date] ?? []).map((meal) => {
              const impact = impacts.get(meal.id);
              return impact
                ? { ...meal, impact, tagged: true }
                : meal;
            }),
          },
        };
      });
    },
    [update],
  );

  const addSymptomForToday = useCallback(
    (entry: Omit<SymptomEntry, 'id' | 'time'>) => {
      addSymptomForDate(toIsoDate(new Date()), entry);
    },
    [addSymptomForDate],
  );

  const addLabReport = useCallback(
    (entry: Omit<LabReportEntry, 'id'>) => {
      const full: LabReportEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };
      update((prev) => ({
        ...prev,
        // Newest first, so the screens can just read the head of the list.
        labReports: [full, ...prev.labReports].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      }));
    },
    [update],
  );

  const removeLabReport = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        labReports: prev.labReports.filter((report) => report.id !== id),
      }));
    },
    [update],
  );

  const addMeal = useCallback(
    // The date is explicit so a meal forgotten yesterday can be logged
    // against yesterday rather than landing on today.
    (entry: Omit<MealEntry, 'id' | 'time'>, dateIso?: string) => {
      const now = new Date();
      const target = dateIso ?? toIsoDate(now);
      const full: MealEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes(),
        ).padStart(2, '0')}`,
      };
      update((prev) => ({
        ...prev,
        meals: {
          ...prev.meals,
          [target]: [...(prev.meals[target] ?? []), full],
        },
      }));
    },
    [update],
  );

  const removeMeal = useCallback(
    (date: string, id: string) => {
      update((prev) => ({
        ...prev,
        meals: {
          ...prev.meals,
          [date]: (prev.meals[date] ?? []).filter((m) => m.id !== id),
        },
      }));
    },
    [update],
  );

  const addAppointment = useCallback(
    (entry: Omit<AppointmentEntry, 'id'>) => {
      const full: AppointmentEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };
      update((prev) => ({
        ...prev,
        appointments: [...prev.appointments, full],
      }));
    },
    [update],
  );

  /*
   * Where the database would come in.
   *
   * These four actions are the only writers of workout state, so they are the
   * seam for a server. Today everything lands in AsyncStorage through setLog,
   * which is what the whole log already does -- and deliberately so: this data
   * sits next to symptoms and medication, and the app has no real accounts yet
   * (profile.loggedIn is a local boolean), so nothing here should leave the
   * device until there is an authenticated user to attach it to.
   *
   * With auth in place, each of these would additionally upsert to Supabase --
   * workout_plans (one row per plan), exercise_log (exercise_id, reps, weight)
   * and completed_workouts (user_id, date, plan_day_id, results) -- writing
   * local state first so the UI stays instant, then syncing. Row level security
   * has to scope every table to auth.uid(); the anon key the app ships with is
   * public, and flora_knowledge is readable with it.
   */
  const saveWorkoutPlan = useCallback((plan: WorkoutPlan | null) => {
    // A new plan invalidates what was typed against the old exercises, since
    // the ids no longer refer to anything.
    setLog((prev) => ({ ...prev, workoutPlan: plan, exerciseLog: {} }));
  }, []);

  const setExerciseResult = useCallback(
    (
      exerciseId: string,
      value: { reps: string; weightKg: string; minutes: string },
    ) => {
      setLog((prev) => ({
        ...prev,
        exerciseLog: { ...prev.exerciseLog, [exerciseId]: value },
      }));
    },
    [],
  );

  const completeWorkoutDay = useCallback(
    (day: PlannedDay, dateIso: string) => {
      setLog((prev) => {
        const already = prev.completedWorkouts[dateIso] ?? [];
        if (already.some((entry) => entry.planDayId === day.id)) return prev;

        // Whatever was typed is copied in, so editing the plan later cannot
        // rewrite what the user recorded as done.
        const entry: CompletedWorkout = {
          id: `${day.id}-${dateIso}`,
          planDayId: day.id,
          title: day.title,
          kind: day.kind,
          durationMin: day.durationMin,
          results: day.exercises.map((exercise) => ({
            exerciseId: exercise.id,
            name: exercise.name,
            reps: prev.exerciseLog[exercise.id]?.reps ?? '',
            weightKg: prev.exerciseLog[exercise.id]?.weightKg ?? '',
            minutes: prev.exerciseLog[exercise.id]?.minutes ?? '',
          })),
        };

        return {
          ...prev,
          completedWorkouts: {
            ...prev.completedWorkouts,
            [dateIso]: [...already, entry],
          },
        };
      });
    },
    [],
  );

  const uncompleteWorkoutDay = useCallback(
    (planDayId: string, dateIso: string) => {
      setLog((prev) => {
        const already = prev.completedWorkouts[dateIso] ?? [];
        const next = already.filter((entry) => entry.planDayId !== planDayId);
        if (next.length === already.length) return prev;

        const map = { ...prev.completedWorkouts };
        if (next.length) map[dateIso] = next;
        else delete map[dateIso];
        return { ...prev, completedWorkouts: map };
      });
    },
    [],
  );

  const removeAppointment = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        appointments: prev.appointments.filter((a) => a.id !== id),
      }));
    },
    [update],
  );

  const addMedication = useCallback(
    (entry: Omit<MedicationEntry, 'id'>) => {
      const full: MedicationEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      };
      const biologicAppointment: AppointmentEntry | null =
        full.type === 'biologic' && full.nextDoseDate
          ? {
              id: `biologic-${full.id}`,
              doctor: full.name,
              exam: `Biológiai terápia · ${
                full.administrationLocation === 'hospital'
                  ? 'Kórházban'
                  : 'Otthon'
              }`,
              date: full.nextDoseDate,
              time: '',
              allDay: true,
              medicationId: full.id,
            }
          : null;
      update((prev) => ({
        ...prev,
        medications: [...prev.medications, full],
        appointments: biologicAppointment
          ? [...prev.appointments, biologicAppointment]
          : prev.appointments,
        noMeds: false,
      }));
    },
    [update],
  );

  const setNoMeds = useCallback(
    (value: boolean) => {
      update((prev) => ({
        ...prev,
        noMeds: value,
        medications: value ? [] : prev.medications,
        appointments: value
          ? prev.appointments.filter((appointment) => !appointment.medicationId)
          : prev.appointments,
      }));
    },
    [update],
  );

  const resetMedications = useCallback(
    (noMeds: boolean) => {
      update((prev) => ({
        ...prev,
        medications: [],
        appointments: prev.appointments.filter(
          (appointment) => !appointment.medicationId,
        ),
        noMeds,
      }));
    },
    [update],
  );

  const removeMedication = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        medications: prev.medications.filter((m) => m.id !== id),
        appointments: prev.appointments.filter(
          (appointment) => appointment.medicationId !== id,
        ),
      }));
    },
    [update],
  );

  const takeMedicationDose = useCallback(
    // The date is explicit so a dose missed yesterday can still be ticked off
    // on the day it belonged to, rather than landing on today.
    (id: string, time: string, dateIso?: string) => {
      const today = dateIso ?? toIsoDate(new Date());
      const key = medicationDoseKey(id, time);
      update((prev) => {
        const current = (prev.takenDoses ?? {})[today] ?? [];
        if (current.includes(key)) return prev;
        return {
          ...prev,
          medications: prev.medications.map((medication) =>
            medication.id === id
              ? {
                  ...medication,
                  inventoryRemaining: Math.max(
                    0,
                    medication.inventoryRemaining - 1,
                  ),
                }
              : medication,
          ),
          takenDoses: {
            ...(prev.takenDoses ?? {}),
            [today]: [...current, key],
          },
        };
      });
    },
    [update],
  );

  const value = useMemo(
    () => ({
      ready,
      log,
      setMoodForToday,
      addSymptomForToday,
      addSymptomForDate,
      saveYesterdayJournalForDate,
      addLabReport,
      removeLabReport,
      addMeal,
      removeMeal,
      addAppointment,
      removeAppointment,
      addMedication,
      removeMedication,
      takeMedicationDose,
      setNoMeds,
      resetMedications,
      saveWorkoutPlan,
      setExerciseResult,
      completeWorkoutDay,
      uncompleteWorkoutDay,
    }),
    [
      ready,
      log,
      setMoodForToday,
      addSymptomForToday,
      addSymptomForDate,
      saveYesterdayJournalForDate,
      addLabReport,
      removeLabReport,
      addMeal,
      removeMeal,
      addAppointment,
      removeAppointment,
      addMedication,
      removeMedication,
      takeMedicationDose,
      setNoMeds,
      resetMedications,
      saveWorkoutPlan,
      setExerciseResult,
      completeWorkoutDay,
      uncompleteWorkoutDay,
    ],
  );

  return (
    <HealthLogContext.Provider value={value}>
      {children}
    </HealthLogContext.Provider>
  );
}

export function useHealthLog() {
  const ctx = useContext(HealthLogContext);
  if (!ctx)
    throw new Error('useHealthLog must be used within HealthLogProvider');
  return ctx;
}

/* --------------------------------------------------------------- */
/* Kalóriabecslés                                                    */
/* --------------------------------------------------------------- */

// Gyakori ételek hozzávetőleges kalóriaértéke (közepes adagra).
const FOOD_CALORIES: { keywords: string[]; kcal: number }[] = [
  { keywords: ['csirke', 'csirkemell', 'pulyka'], kcal: 250 },
  { keywords: ['lazac', 'hal', 'tonhal', 'hekk'], kcal: 220 },
  { keywords: ['marha', 'sertes', 'karaj', 'tarja'], kcal: 320 },
  { keywords: ['rizs', 'rizzsel'], kcal: 180 },
  { keywords: ['teszta', 'spagetti', 'makaroni', 'lasagne'], kcal: 320 },
  { keywords: ['burgonya', 'krumpli', 'pure'], kcal: 160 },
  { keywords: ['tojas', 'rantotta', 'omlett'], kcal: 150 },
  { keywords: ['kenyer', 'kifli', 'zsemle', 'piritos'], kcal: 130 },
  { keywords: ['zab', 'zabkasa', 'muzli', 'granola'], kcal: 290 },
  { keywords: ['joghurt', 'kefir'], kcal: 120 },
  { keywords: ['turo', 'sajt'], kcal: 160 },
  { keywords: ['sonka', 'felvagott', 'szalami'], kcal: 130 },
  { keywords: ['smoothie', 'turmix'], kcal: 250 },
  { keywords: ['leves', 'huslé', 'husleves'], kcal: 180 },
  { keywords: ['salata'], kcal: 130 },
  { keywords: ['fozelek'], kcal: 250 },
  { keywords: ['gulyas', 'porkolt', 'paprikas'], kcal: 430 },
  { keywords: ['pizza'], kcal: 600 },
  { keywords: ['hamburger', 'burger'], kcal: 550 },
  { keywords: ['szendvics', 'melegszendvics'], kcal: 300 },
  { keywords: ['palacsinta'], kcal: 350 },
  { keywords: ['suti', 'sutemeny', 'torta', 'keksz'], kcal: 300 },
  { keywords: ['csoki', 'csokolade'], kcal: 250 },
  { keywords: ['banan'], kcal: 100 },
  { keywords: ['alma', 'korte', 'barack'], kcal: 80 },
  { keywords: ['gyumolcs', 'bogyos'], kcal: 90 },
  { keywords: ['zoldseg', 'brokkoli', 'cukkini', 'repa'], kcal: 60 },
  { keywords: ['tej', 'kakao'], kcal: 130 },
  { keywords: ['avokado'], kcal: 200 },
];

// Ha semmit sem ismerünk fel, az étkezés típusa alapján becslünk.
const MEAL_TYPE_FALLBACK: Record<MealType, number> = {
  breakfast: 350,
  lunch: 550,
  dinner: 450,
  snack: 200,
};

const PORTION_MULTIPLIER: Record<Portion, number> = {
  small: 0.7,
  medium: 1,
  large: 1.35,
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Egyszerű helyi kalóriabecslés az étel neve, adag és típus alapján. */
export function estimateCalories(
  name: string,
  portion: Portion,
  mealType: MealType,
): number {
  const n = normalize(name);
  let sum = 0;
  for (const food of FOOD_CALORIES) {
    if (food.keywords.some((kw) => n.includes(kw))) {
      sum += food.kcal;
    }
  }
  const base = sum > 0 ? sum : MEAL_TYPE_FALLBACK[mealType];
  return Math.round((base * PORTION_MULTIPLIER[portion]) / 5) * 5;
}

export const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Reggeli',
  lunch: 'Ebéd',
  dinner: 'Vacsora',
  snack: 'Nasi',
};

export const mealTypeEmoji: Record<MealType, string> = {
  breakfast: '🥐',
  lunch: '🍲',
  dinner: '🍽️',
  snack: '🍎',
};

export const portionLabels: Record<Portion, string> = {
  small: 'Kicsi adag',
  medium: 'Közepes adag',
  large: 'Nagy adag',
};

export const MOOD_EMOJI = ['😫', '😔', '😐', '🙂', '😄'] as const;
export const MOOD_LABELS = [
  'Szörnyű',
  'Gyenge',
  'Semleges',
  'Jó',
  'Remek',
] as const;
