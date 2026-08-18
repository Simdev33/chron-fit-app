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

export type MealEntry = {
  id: string;
  time: string; // "HH:MM"
  name: string;
  portion: Portion;
  mealType: MealType;
  calories: number;
  impact?: FoodImpact;
  tagged?: boolean;
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

export type MedicationEntry = {
  id: string;
  name: string;
  dose: string;
  type: 'pill' | 'supplement' | 'biologic';
  times: string[];
  inventoryRemaining: number;
  refillThreshold: number;
  since: string;
  administrationLocation?: 'home' | 'hospital';
  intervalMonths?: 1 | 2 | 3;
  lastDoseDate?: string;
  nextDoseDate?: string;
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
  addMealForToday: (entry: Omit<MealEntry, 'id' | 'time'>) => void;
  removeMeal: (date: string, id: string) => void;
  addAppointment: (entry: Omit<AppointmentEntry, 'id'>) => void;
  removeAppointment: (id: string) => void;
  addMedication: (entry: Omit<MedicationEntry, 'id'>) => void;
  removeMedication: (id: string) => void;
  takeMedicationDose: (id: string, time: string) => void;
  /** „Nem szedek gyógyszert” jelző; bekapcsolva a gyógyszerlista is ürül. */
  setNoMeds: (value: boolean) => void;
  /** Onboarding után: üres gyógyszerlista + a noMeds jelző beállítása. */
  resetMedications: (noMeds: boolean) => void;
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

  const addMealForToday = useCallback(
    (entry: Omit<MealEntry, 'id' | 'time'>) => {
      const now = new Date();
      const today = toIsoDate(now);
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
          [today]: [...(prev.meals[today] ?? []), full],
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
    (id: string, time: string) => {
      const today = toIsoDate(new Date());
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
      addMealForToday,
      removeMeal,
      addAppointment,
      removeAppointment,
      addMedication,
      removeMedication,
      takeMedicationDose,
      setNoMeds,
      resetMedications,
    }),
    [
      ready,
      log,
      setMoodForToday,
      addSymptomForToday,
      addSymptomForDate,
      saveYesterdayJournalForDate,
      addMealForToday,
      removeMeal,
      addAppointment,
      removeAppointment,
      addMedication,
      removeMedication,
      takeMedicationDose,
      setNoMeds,
      resetMedications,
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
