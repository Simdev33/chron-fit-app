import { router } from 'expo-router';
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
  step: number;
  screen: 'Home' | 'Lifestyle' | 'Organizer' | 'Health';
  targetId:
    | 'dashboard-header'
    | 'quick-actions'
    | 'tab-lifestyle'
    | 'tab-organizer'
    | 'tab-health';
  text: string;
  action: 'tap' | 'navigate' | 'finish';
};

export const tutorialSteps: TutorialStep[] = [
  {
    step: 1,
    screen: 'Home',
    targetId: 'dashboard-header',
    text: 'Üdvözöllek a CrohnSync-ben! Én Flóra vagyok, a személyes asszisztensed. Engedd meg, hogy gyorsan körbevezesselek!',
    action: 'tap',
  },
  {
    step: 2,
    screen: 'Home',
    targetId: 'quick-actions',
    text: 'Itt a Kezdőlapon találod a gyors gombokat. Bármikor egy kattintással rögzítheted a tüneteidet vagy az étkezésedet.',
    action: 'tap',
  },
  {
    step: 3,
    screen: 'Lifestyle',
    targetId: 'tab-lifestyle',
    text: 'Lépjünk át az Életmód menübe! Itt tudod vezetni a részletes étrendedet és az edzéseidet, hogy lássuk, mi tesz jót a testednek.',
    action: 'navigate',
  },
  {
    step: 4,
    screen: 'Organizer',
    targetId: 'tab-organizer',
    text: 'Ez a Szervező. Ide rögzítjük a gyógyszereidet és a közelgő orvosi időpontokat (pl. vérvétel). Én pedig majd szólok, ha be kell venni valamit!',
    action: 'navigate',
  },
  {
    step: 5,
    screen: 'Health',
    targetId: 'tab-health',
    text: 'Végül az Egészség menü. Itt találod az AI elemzéseidet a rögzített adatok alapján. Bármikor írhatsz nekem, ha tanácsra van szükséged. Vágjunk is bele!',
    action: 'finish',
  },
];

export const TUTORIAL_STEPS = tutorialSteps;

export type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TutorialContextValue = {
  active: boolean;
  stepIndex: number;
  currentStep: TutorialStep;
  targetRect: TargetRect | null;
  transitioning: boolean;
  next: () => void;
  skip: () => void;
  setTargetRect: (rect: TargetRect | null) => void;
  setTransitioning: (value: boolean) => void;
  registerTarget: (key: string, node: View | null) => void;
  measureTarget: (key: string) => Promise<TargetRect | null>;
  restart: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { ready, profile, updateProfile } = useProfile();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [transitioning, setTransitioning] = useState(false);
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
        setTargetRect(null);
        setTransitioning(true);
        setActive(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [ready, profile.loggedIn, profile.onboarded, profile.tutorialDone]);

  const finish = useCallback(() => {
    setActive(false);
    setTargetRect(null);
    setTransitioning(false);
    updateProfile({ tutorialDone: true });
    // The walkthrough leaves the user wherever its last step went -- the
    // Health tab at the end, or whichever tab they skipped from. Neither is
    // somewhere they chose to be, so it hands them back to the home screen.
    router.navigate('/');
  }, [updateProfile]);

  // Replaying the tutorial cannot go through profile.tutorialDone alone,
  // because the auto-start effect only ever fires once per launch.
  const restart = useCallback(() => {
    startedRef.current = true;
    setStepIndex(0);
    setTargetRect(null);
    setTransitioning(true);
    setActive(true);
    updateProfile({ tutorialDone: false });
  }, [updateProfile]);

  const next = useCallback(() => {
    const step = tutorialSteps[stepIndex];
    if (
      step.action === 'finish' ||
      stepIndex + 1 >= tutorialSteps.length
    ) {
      finish();
      return;
    }
    setTargetRect(null);
    setTransitioning(true);
    setStepIndex(stepIndex + 1);
  }, [finish, stepIndex]);

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
        if (!node) {
          resolve(null);
          return;
        }

        if (typeof node.measureInWindow === 'function') {
          node.measureInWindow((x, y, width, height) => {
            if (!width && !height) {
              resolve(null);
            } else {
              resolve({ x, y, width, height });
            }
          });
          return;
        }

        const webNode = node as unknown as {
          getBoundingClientRect?: () => {
            left: number;
            top: number;
            width: number;
            height: number;
          };
        };
        if (typeof webNode.getBoundingClientRect === 'function') {
          const rect = webNode.getBoundingClientRect();
          resolve(
            rect.width || rect.height
              ? {
                  x: rect.left,
                  y: rect.top,
                  width: rect.width,
                  height: rect.height,
                }
              : null,
          );
          return;
        }

        resolve(null);
      }),
    [],
  );

  const value = useMemo(
    () => ({
      active,
      stepIndex,
      currentStep: tutorialSteps[stepIndex] ?? tutorialSteps[0],
      targetRect,
      transitioning,
      next,
      skip: finish,
      setTargetRect,
      setTransitioning,
      registerTarget,
      measureTarget,
      restart,
    }),
    [
      active,
      stepIndex,
      targetRect,
      transitioning,
      next,
      finish,
      registerTarget,
      measureTarget,
      restart,
    ],
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
