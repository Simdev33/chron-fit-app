import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type LifestylePane = 'diet' | 'fitness';

type FloraSceneValue = {
  lifestylePane: LifestylePane;
  setLifestylePane: (pane: LifestylePane) => void;
  /**
   * Shown right after the user dismisses Flora, to point out the way back.
   * Deliberately not persisted — it is a one-off nudge, not a preference.
   */
  floraHint: boolean;
  showFloraHint: () => void;
  hideFloraHint: () => void;
};

const FloraSceneContext = createContext<FloraSceneValue | null>(null);

export function FloraSceneProvider({ children }: { children: React.ReactNode }) {
  const [lifestylePane, setLifestylePane] = useState<LifestylePane>('diet');
  const [floraHint, setFloraHint] = useState(false);
  const showFloraHint = useCallback(() => setFloraHint(true), []);
  const hideFloraHint = useCallback(() => setFloraHint(false), []);
  const value = useMemo(
    () => ({
      lifestylePane,
      setLifestylePane,
      floraHint,
      showFloraHint,
      hideFloraHint,
    }),
    [floraHint, hideFloraHint, lifestylePane, showFloraHint],
  );
  return (
    <FloraSceneContext.Provider value={value}>
      {children}
    </FloraSceneContext.Provider>
  );
}

export function useFloraScene() {
  const ctx = useContext(FloraSceneContext);
  return ctx ?? FALLBACK;
}

const FALLBACK: FloraSceneValue = {
  lifestylePane: 'diet',
  setLifestylePane: () => {},
  floraHint: false,
  showFloraHint: () => {},
  hideFloraHint: () => {},
};
