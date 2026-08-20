import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The floating tab bar is absolutely positioned, so screens have to reserve
 * room for it themselves. Its height depends on the device's bottom inset and
 * on the user's font scale, which a constant cannot capture -- every screen
 * used to guess 140 and that was too little on phones with a navigation bar.
 * The bar measures itself here instead, and screens read the real number.
 */

type TabBarContextValue = {
  /** Height of the bar including the space it keeps clear below itself. */
  height: number;
  setHeight: (height: number) => void;
};

const TabBarContext = createContext<TabBarContextValue | null>(null);

/** Rough size of the bar itself, used only until the first measurement. */
const ESTIMATED_BAR_HEIGHT = 90;

export function TabBarHeightProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [measured, setMeasured] = useState<number | null>(null);

  const value = useMemo<TabBarContextValue>(
    () => ({
      height:
        measured ??
        ESTIMATED_BAR_HEIGHT + Math.max(insets.bottom, 12) + 4,
      setHeight: (height: number) =>
        setMeasured((current) =>
          current !== null && Math.abs(current - height) < 1 ? current : height,
        ),
    }),
    [measured, insets.bottom],
  );

  return (
    <TabBarContext.Provider value={value}>{children}</TabBarContext.Provider>
  );
}

/** Space a scrollable screen should leave at the bottom, tab bar included. */
export function useTabBarSpacing(extra = 24) {
  const ctx = useContext(TabBarContext);
  const insets = useSafeAreaInsets();
  if (!ctx) return ESTIMATED_BAR_HEIGHT + Math.max(insets.bottom, 12) + extra;
  return ctx.height + extra;
}

export function useTabBarMeasurement() {
  const ctx = useContext(TabBarContext);
  return ctx?.setHeight;
}
