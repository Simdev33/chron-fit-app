import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type SymptomEntry = {
  id: string;
  time: string; // "HH:MM"
  pain: number; // 0-10
  bristol: number | null; // 1-7
  blood: boolean;
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
};

export type AppointmentEntry = {
  id: string;
  doctor: string; // orvos vagy intézmény
  exam: string; // vizsgálat / szakterület
  date: string; // ISO dátum (YYYY-MM-DD)
  time: string; // "HH:MM"
};

export type MedicationEntry = {
  id: string;
  name: string;
  dose: string;
  time: string; // "HH:MM"
  times: string; // pl. "1× naponta"
  /** A profil „felírt gyógyszerek” listájából származik. */
  fromProfile?: boolean;
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
    time: '8:00',
    times: '3× naponta',
  },
  {
    id: 'med-2',
    name: 'Azathioprine',
    dose: '100mg',
    time: '8:00',
    times: '1× naponta',
  },
  {
    id: 'med-3',
    name: 'Probiotikum',
    dose: '10Mrd CFU',
    time: '21:00',
    times: '1× naponta',
  },
  {
    id: 'med-4',
    name: 'D3-vitamin',
    dose: '2000 NE',
    time: '8:00',
    times: '1× naponta',
  },
];

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
  addMealForToday: (entry: Omit<MealEntry, 'id' | 'time'>) => void;
  removeMeal: (date: string, id: string) => void;
  addAppointment: (entry: Omit<AppointmentEntry, 'id'>) => void;
  removeAppointment: (id: string) => void;
  addMedication: (entry: Omit<MedicationEntry, 'id'>) => void;
  removeMedication: (id: string) => void;
  /** Mai adag bevétele / visszavonása. */
  toggleMedicationTaken: (id: string) => void;
  /** „Nem szedek gyógyszert” jelző; bekapcsolva a gyógyszerlista is ürül. */
  setNoMeds: (value: boolean) => void;
  /** Onboarding után: üres gyógyszerlista + a noMeds jelző beállítása. */
  resetMedications: (noMeds: boolean) => void;
  /** A profil felírt gyógyszereit szinkronizálja a bevételi listával. */
  syncMedicationsFromProfile: (
    entries: { name: string; since: string }[],
    noMeds: boolean,
  ) => void;
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
            medications: parsed.medications ?? seedMedications,
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

  const addSymptomForToday = useCallback(
    (entry: Omit<SymptomEntry, 'id' | 'time'>) => {
      const now = new Date();
      const today = toIsoDate(now);
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
          [today]: [...(prev.symptoms[today] ?? []), full],
        },
      }));
    },
    [update],
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
      update((prev) => ({
        ...prev,
        medications: [...prev.medications, full],
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
      }));
    },
    [update],
  );

  const resetMedications = useCallback(
    (noMeds: boolean) => {
      update((prev) => ({ ...prev, medications: [], noMeds }));
    },
    [update],
  );

  const syncMedicationsFromProfile = useCallback(
    (entries: { name: string; since: string }[], noMeds: boolean) => {
      update((prev) => {
        if (noMeds) {
          return { ...prev, noMeds: true, medications: [] };
        }
        const names = new Set(entries.map((e) => e.name.toLowerCase()));
        const kept = prev.medications.filter(
          (m) => !m.fromProfile && !names.has(m.name.toLowerCase()),
        );
        const fromProfile = entries.map((e, i) => {
          const existing = prev.medications.find(
            (m) => m.name.toLowerCase() === e.name.toLowerCase(),
          );
          if (existing) {
            return existing.fromProfile
              ? existing
              : { ...existing, fromProfile: true as const };
          }
          return {
            id: `profile-${e.name.toLowerCase()}-${i}`,
            name: e.name,
            dose: '—',
            time: '8:00',
            times: e.since ? `${e.since.slice(0, 7)}-től` : '1× naponta',
            fromProfile: true,
          };
        });
        return {
          ...prev,
          noMeds: false,
          medications: [...fromProfile, ...kept],
        };
      });
    },
    [update],
  );

  const removeMedication = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        medications: prev.medications.filter((m) => m.id !== id),
      }));
    },
    [update],
  );

  const toggleMedicationTaken = useCallback(
    (id: string) => {
      const today = toIsoDate(new Date());
      update((prev) => {
        const current = (prev.takenDoses ?? {})[today] ?? [];
        const next = current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id];
        return {
          ...prev,
          takenDoses: { ...(prev.takenDoses ?? {}), [today]: next },
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
      addMealForToday,
      removeMeal,
      addAppointment,
      removeAppointment,
      addMedication,
      removeMedication,
      toggleMedicationTaken,
      setNoMeds,
      resetMedications,
      syncMedicationsFromProfile,
    }),
    [
      ready,
      log,
      setMoodForToday,
      addSymptomForToday,
      addMealForToday,
      removeMeal,
      addAppointment,
      removeAppointment,
      addMedication,
      removeMedication,
      toggleMedicationTaken,
      setNoMeds,
      resetMedications,
      syncMedicationsFromProfile,
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
