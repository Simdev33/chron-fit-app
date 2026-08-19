import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type Diagnosis = 'crohn' | 'uc' | 'ibdu';
export type Phase = 'remission' | 'flare' | 'unknown';

/** Gyógyszer / vitamin / kiegészítő a kezdő dátummal. */
export type SupplementEntry = {
  name: string;
  /** ISO dátum (YYYY-MM-DD) — mikortól szedi */
  since: string;
};

export type Profile = {
  onboarded: boolean;
  loggedIn: boolean;
  /** Az első bejelentkezés utáni bemutató (tutorial) lefutott-e már. */
  tutorialDone: boolean;
  /** A lebegő Flóra el van-e rejtve a képernyőről. */
  floraHidden: boolean;
  email: string;
  name: string;
  diagnosis: Diagnosis;
  phase: Phase;
  triggerFoods: string[];
  goals: string[];
  age: string;
  weightKg: string;
  heightCm: string;
  avatarColorIdx: number;
  prescribedMeds: SupplementEntry[];
  biologics: SupplementEntry[];
  vitamins: SupplementEntry[];
  fitnessSupplements: SupplementEntry[];
  noPrescribedMeds: boolean;
  noBiologics: boolean;
  noVitamins: boolean;
  noFitnessSupplements: boolean;
  noTriggerFoods: boolean;
  /** Érintett vagy eltávolított bélszakaszok. */
  resectedSegments: string[];
  hasStoma: boolean;
  /** Csak akkor értelmes, ha hasStoma igaz. */
  stomaType: string;
  hadSurgery: boolean;
  surgeryNotes: string;
  /** Ízületi panaszok (bélrendszeren kívüli tünet). */
  jointSymptoms: boolean;
  /** Bőrtünetek (bélrendszeren kívüli tünet). */
  skinSymptoms: boolean;
  /** Rosttolerancia 1-5 skálán. */
  fiberTolerance: number;
  /** 'low-residue' | 'standard' | 'high-fiber' */
  dietApproach: string;
  noExercise: boolean;
  workoutFrequency: number;
  workoutFocus: string[];
};

const STORAGE_KEY = 'crohnsync-profile-v1';

const defaultProfile: Profile = {
  onboarded: false,
  loggedIn: false,
  tutorialDone: false,
  floraHidden: false,
  email: '',
  name: 'Anna',
  diagnosis: 'crohn',
  phase: 'remission',
  triggerFoods: [],
  goals: [],
  age: '',
  weightKg: '',
  heightCm: '',
  avatarColorIdx: 0,
  prescribedMeds: [],
  biologics: [],
  vitamins: [],
  fitnessSupplements: [],
  noPrescribedMeds: false,
  noBiologics: false,
  noVitamins: false,
  noFitnessSupplements: false,
  noTriggerFoods: false,
  resectedSegments: [],
  hasStoma: false,
  stomaType: '',
  hadSurgery: false,
  surgeryNotes: '',
  jointSymptoms: false,
  skinSymptoms: false,
  // Neutral until the user says otherwise; the old UI defaults were demo values.
  fiberTolerance: 3,
  dietApproach: 'standard',
  noExercise: false,
  workoutFrequency: 3,
  workoutFocus: [],
};

type ProfileContextValue = {
  ready: boolean;
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;
  /** Kamu bejelentkezés: meglévő fióknak tekintjük, onboarding kihagyva. */
  signIn: (email: string) => void;
  /** Kamu regisztráció: új fiók, utána jön az adatbekérő onboarding. */
  signUp: (email: string) => void;
  completeOnboarding: (
    patch: Pick<
      Profile,
      | 'name'
      | 'diagnosis'
      | 'phase'
      | 'triggerFoods'
      | 'goals'
      | 'noPrescribedMeds'
    >,
  ) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** Régi string[] formátumról SupplementEntry[]-re. */
export function asSupplementEntries(raw: unknown): SupplementEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SupplementEntry[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ name: item.trim(), since: '' });
    } else if (item && typeof item === 'object' && 'name' in item) {
      const name = String((item as SupplementEntry).name ?? '').trim();
      if (!name) continue;
      out.push({
        name,
        since: String((item as SupplementEntry).since ?? ''),
      });
    }
  }
  return out;
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as Partial<Profile>;
          setProfile({
            ...defaultProfile,
            ...parsed,
            prescribedMeds: asSupplementEntries(parsed.prescribedMeds),
            biologics: asSupplementEntries(parsed.biologics),
            vitamins: asSupplementEntries(parsed.vitamins),
            fitnessSupplements: asSupplementEntries(parsed.fitnessSupplements),
          });
        }
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: Profile) => {
    setProfile(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const signIn = useCallback(
    (email: string) => {
      updateProfile({ loggedIn: true, email, onboarded: true });
    },
    [updateProfile],
  );

  const signUp = useCallback(
    (email: string) => {
      updateProfile({ loggedIn: true, email, onboarded: false });
    },
    [updateProfile],
  );

  const completeOnboarding = useCallback(
    (
      patch: Pick<
        Profile,
        | 'name'
        | 'diagnosis'
        | 'phase'
        | 'triggerFoods'
        | 'goals'
        | 'noPrescribedMeds'
      >,
    ) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch, onboarded: true };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      ready,
      profile,
      updateProfile,
      signIn,
      signUp,
      completeOnboarding,
    }),
    [ready, profile, updateProfile, signIn, signUp, completeOnboarding],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}

export const diagnosisLabels: Record<Diagnosis, string> = {
  crohn: 'Crohn-betegség',
  uc: 'Colitis ulcerosa',
  ibdu: 'IBD – nem besorolt',
};

export const phaseLabels: Record<Phase, string> = {
  remission: 'Remisszió',
  flare: 'Fellángolás',
  unknown: 'Nem tudom',
};

export const goalOptions = [
  'Remisszió megőrzése edzés mellett',
  'Tünetmentesítés',
  'Orvosi adatok követése',
] as const;

export const triggerFoodOptions = [
  'Csípős ételek',
  'Rántott ételek',
  'Tejtermékek',
  'Glutén',
  'Kávé',
  'Alkohol',
  'Nyers zöldségek',
  'Magvak, diófélék',
  'Szénsavas italok',
  'Cukros édességek',
] as const;
