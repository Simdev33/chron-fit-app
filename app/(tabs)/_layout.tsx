import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import {
  CalendarDays,
  HeartPulse,
  Home,
  UtensilsCrossed,
} from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '@/components/figma/ui';
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay';
import { font, violet } from '@/constants/figma';
import { useTutorial } from '@/context/TutorialContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

const TAB_META: Record<
  string,
  { label: string; Icon: typeof Home }
> = {
  index: { label: 'Kezdőlap', Icon: Home },
  lifestyle: { label: 'Életmód', Icon: UtensilsCrossed },
  schedule: { label: 'Szervező', Icon: CalendarDays },
  medical: { label: 'Egészség', Icon: HeartPulse },
};

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (opts: {
      type: 'tabPress';
      target?: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

function FigmaTabBar({ state, navigation }: TabBarProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { registerTarget } = useTutorial();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: p.navBg,
            borderColor: p.navBorder,
            shadowColor: p.dark ? '#000000' : '#7C3AED',
          },
        ]}>
        {state.routes.map((route, idx) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const focused = state.index === idx;
          const { Icon } = meta;
          return (
            <Pressable
              key={route.key}
              ref={(node) => registerTarget(`tab-${route.name}`, node)}
              collapsable={false}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={({ pressed }) => [
                styles.item,
                pressed && { transform: [{ scale: 0.9 }] },
              ]}>
              {focused ? (
                <LinearGradient
                  colors={[violet[600], violet[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activePill}>
                  <Icon size={20} color="#FFFFFF" />
                </LinearGradient>
              ) : (
                <View style={styles.activePill}>
                  <Icon size={20} color={p.navInactive} />
                </View>
              )}
              <Text
                style={[
                  styles.label,
                  {
                    color: focused ? violet[400] : p.navLabelInactive,
                  },
                ]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <FigmaTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="lifestyle" />
        <Tabs.Screen name="schedule" />
        <Tabs.Screen name="medical" />
      </Tabs>
      <TutorialOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 24,
    borderWidth: 1,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  activePill: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontFamily: font.bodySemi,
  },
});
