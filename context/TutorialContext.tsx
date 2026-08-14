import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { View } from 'react-native';

import { useProfile } from './ProfileContext';

export type TutorialStep = {
  /** A kiemelendő célpont kulcsa; null esetén középre igazított kártya. */
  target: string | null;
  title: string;
  text: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: null,
    title: 'Üdv a CrohnFit-ben! 👋',
    text: 'Gyors körbevezetés következik: megmutatjuk, hol találod a legfontosabb funkciókat. Bármikor kihagyhatod — a lényeg, hogy otthon érezd magad.',
  },
  {
    target: 'home-mood',
    title: 'Napi hangulat',
    text: 'Minden nap jelöld be, hogy érzed magad. A főoldal háttere is ehhez igazodik, és az Egészség tab naptárában bármikor visszanézheted.',
  },
  {
    target: 'home-quick',
    title: 'Gyors műveletek',
    text: 'Innen egyetlen koppintással rögzíthetsz tünetet, étkezést, edzést vagy bevett gyógyszert. Minél többet naplózol, annál többet mutatnak a riportok.',
  },
  {
    target: 'home-ai',
    title: 'AI asszisztens',
    text: 'Naponta rövid összefoglalót kapsz az adataid alapján, és a kártyára koppintva bármit megkérdezhetsz az AI chattől.',
  },
  {
    target: 'tab-lifestyle',
    title: 'Életmód',
    text: 'Étkezésnapló kalóriabecsléssel és kíméletes mozgásformák — minden, ami a mindennapi jóllétet segíti.',
  },
  {
    target: 'tab-schedule',
    title: 'Szervező',
    text: 'A gyógyszereid és az orvosi időpontjaid egy helyen. Új gyógyszert és időpontot is itt tudsz felvenni.',
  },
  {
    target: 'tab-medical',
    title: 'Egészség',
    text: 'Tünetnapló, naptár és laboreredmények. Innen exportálhatsz elegáns PDF riportot is, amit megmutathatsz az orvosodnak. Jó egészséget! 💜',
  },
];

export type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TutorialContextValue = {
  active: boolean;
  stepIndex: number;
  next: () => void;
  skip: () => void;
  registerTarget: (key: string, node: View | null) => void;
  measureTarget: (key: string) => Promise<TargetRect | null>;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { ready, profile, updateProfile } = useProfile();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const targets = useRef(new Map<string, View>());
  const startedRef = useRef(false);

  // Automatikus indítás az első bejelentkezés / regisztráció + onboarding után.
  useEffect(() => {
    if (
      ready &&
      profile.loggedIn &&
      profile.onboarded &&
      !profile.tutorialDone &&
      !startedRef.current
    ) {
      startedRef.current = true;
      const t = setTimeout(() => {
        setStepIndex(0);
        setActive(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [ready, profile.loggedIn, profile.onboarded, profile.tutorialDone]);

  const finish = useCallback(() => {
    setActive(false);
    updateProfile({ tutorialDone: true });
  }, [updateProfile]);

  const next = useCallback(() => {
    setStepIndex((idx) => {
      if (idx + 1 >= TUTORIAL_STEPS.length) {
        finish();
        return idx;
      }
      return idx + 1;
    });
  }, [finish]);

  const registerTarget = useCallback((key: string, node: View | null) => {
    if (node) {
      targets.current.set(key, node);
    } else {
      targets.current.delete(key);
    }
  }, []);

  const measureTarget = useCallback(
    (key: string) =>
      new Promise<TargetRect | null>((resolve) => {
        const node = targets.current.get(key);
        if (!node || typeof node.measureInWindow !== 'function') {
          resolve(null);
          return;
        }
        node.measureInWindow((x, y, width, height) => {
          if (!width && !height) {
            resolve(null);
          } else {
            resolve({ x, y, width, height });
          }
        });
      }),
    [],
  );

  const value = useMemo(
    () => ({
      active,
      stepIndex,
      next,
      skip: finish,
      registerTarget,
      measureTarget,
    }),
    [active, stepIndex, next, finish, registerTarget, measureTarget],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return ctx;
}

/** Callback-ref, amivel egy nézet tutorial-célponttá tehető. */
export function useTutorialTarget(key: string) {
  const { registerTarget } = useTutorial();
  return useCallback(
    (node: View | null) => registerTarget(key, node),
    [key, registerTarget],
  );
}
