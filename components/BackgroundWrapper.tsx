import { LinearGradient } from 'expo-linear-gradient';
import React, { type PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useAppTheme } from '@/context/ThemeContext';

export type BackgroundVariant =
  | 'dashboard'
  | 'lifestyle'
  | 'organizer'
  | 'health';

type BackgroundWrapperProps = PropsWithChildren<{
  variant: BackgroundVariant;
  style?: StyleProp<ViewStyle>;
}>;

type VariantConfig = {
  base: readonly [string, string, string];
  primary: {
    color: string;
    cx: string;
    cy: string;
    radius: string;
  };
  ambient: {
    color: string;
    cx: string;
    cy: string;
    radius: string;
  };
};

const VARIANTS: Record<BackgroundVariant, VariantConfig> = {
  dashboard: {
    base: ['#120524', '#0B071A', '#050510'],
    primary: { color: '#D946EF', cx: '4%', cy: '3%', radius: '67%' },
    ambient: { color: '#6D28D9', cx: '82%', cy: '92%', radius: '58%' },
  },
  lifestyle: {
    base: ['#14072A', '#0C0A20', '#050812'],
    primary: { color: '#22D3EE', cx: '96%', cy: '98%', radius: '65%' },
    ambient: { color: '#14B8A6', cx: '76%', cy: '72%', radius: '48%' },
  },
  organizer: {
    base: ['#120524', '#090A22', '#050510'],
    primary: { color: '#3B82F6', cx: '96%', cy: '2%', radius: '64%' },
    ambient: { color: '#6366F1', cx: '78%', cy: '34%', radius: '48%' },
  },
  health: {
    base: ['#120524', '#0D071D', '#050510'],
    primary: { color: '#E879F9', cx: '3%', cy: '52%', radius: '64%' },
    ambient: { color: '#A78BFA', cx: '28%', cy: '58%', radius: '48%' },
  },
};

export function BackgroundWrapper({
  children,
  variant,
  style,
}: BackgroundWrapperProps) {
  const { isDark } = useAppTheme();
  const config = VARIANTS[variant];
  const primaryId = `${variant}-background-primary`;
  const ambientId = `${variant}-background-ambient`;

  return (
    <View style={[styles.container, style]}>
      <View pointerEvents="none" style={styles.background}>
        <LinearGradient
          colors={config.base}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        />

        <Svg
          width="100%"
          height="100%"
          style={styles.fill}>
          <Defs>
            <RadialGradient
              id={primaryId}
              cx={config.primary.cx}
              cy={config.primary.cy}
              r={config.primary.radius}>
              <Stop
                offset="0%"
                stopColor={config.primary.color}
                stopOpacity={0.2}
              />
              <Stop
                offset="42%"
                stopColor={config.primary.color}
                stopOpacity={0.09}
              />
              <Stop
                offset="100%"
                stopColor={config.primary.color}
                stopOpacity={0}
              />
            </RadialGradient>
            <RadialGradient
              id={ambientId}
              cx={config.ambient.cx}
              cy={config.ambient.cy}
              r={config.ambient.radius}>
              <Stop
                offset="0%"
                stopColor={config.ambient.color}
                stopOpacity={0.13}
              />
              <Stop
                offset="50%"
                stopColor={config.ambient.color}
                stopOpacity={0.05}
              />
              <Stop
                offset="100%"
                stopColor={config.ambient.color}
                stopOpacity={0}
              />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${primaryId})`} />
          <Rect width="100%" height="100%" fill={`url(#${ambientId})`} />
        </Svg>

        <View
          style={[
            styles.fill,
            {
              backgroundColor: isDark
                ? 'rgba(3,2,10,0.12)'
                : 'rgba(248,246,255,0.78)',
            },
          ]}
        />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    zIndex: 0,
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: -1,
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
