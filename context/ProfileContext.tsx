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

export type Profile = {
  onboarded: boolean;
  loggedIn: boolean;
  /** Az első bejelentkezés utáni bemutató (tutorial) lefutott-e már. */
  tutorialDone: boolean;
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
};

const STORAGE_KEY = 'crohnsync-profile-v1';

const defaultProfile: Profile = {
  onboarded: false,
  loggedIn: false,
  tutorialDone: false,
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
      'name' | 'diagnosis' | 'phase' | 'triggerFoods' | 'goals'
    >,
  ) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && !cancelled) {
          setProfile({ ...defaultProfile, ...(JSON.parse(raw) as Profile) });
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
        'name' | 'diagnosis' | 'phase' | 'triggerFoods' | 'goals'
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
