export type ThemeMode = 'light' | 'dark';

export type AppColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  ring: string;
  insight: string;
  insightForeground: string;
  insightAccent: string;
  accentPurple: string;
  accentPurpleForeground: string;
  accentPurpleSoft: string;
  liftShadow: string;
  glassHighlight: string;
  tabBarBg: string;
  glassCard: string;
  glassSecondary: string;
  glassBorder: string;
  glassPrimaryFrom: string;
  glassPrimaryTo: string;
};

export const lightColors: AppColors = {
  background: '#f8f9fa',
  foreground: '#1f2a26',
  card: '#ffffff',
  cardForeground: '#1f2a26',
  primary: '#88a795',
  primaryForeground: '#ffffff',
  secondary: '#eef2ef',
  secondaryForeground: '#3a4a43',
  muted: '#f0f2f3',
  mutedForeground: '#6b7772',
  accent: '#eef2ef',
  accentForeground: '#3a4a43',
  destructive: '#d97066',
  destructiveForeground: '#ffffff',
  border: '#e6e9e8',
  ring: '#88a795',
  insight: '#f3eef9',
  insightForeground: '#3f2d63',
  insightAccent: '#6b46c1',
  accentPurple: '#805ad5',
  accentPurpleForeground: '#ffffff',
  accentPurpleSoft: '#ede4fb',
  liftShadow: 'rgba(79, 52, 126, 0.2)',
  glassHighlight: 'rgba(255, 255, 255, 0.65)',
  tabBarBg: '#ffffff',
  glassCard: 'rgba(255, 255, 255, 0.92)',
  glassSecondary: '#eef2ef',
  glassBorder: '#e6e9e8',
  glassPrimaryFrom: '#805ad5',
  glassPrimaryTo: '#6b46c1',
};

export const darkColors: AppColors = {
  background: '#121212',
  foreground: '#ececec',
  card: '#1e1e1e',
  cardForeground: '#ececec',
  primary: '#88a795',
  primaryForeground: '#10201a',
  secondary: '#262626',
  secondaryForeground: '#d6ddd9',
  muted: '#232323',
  mutedForeground: '#9aa5a0',
  accent: '#262626',
  accentForeground: '#d6ddd9',
  destructive: '#d97066',
  destructiveForeground: '#ffffff',
  border: '#2c2c2c',
  ring: '#88a795',
  insight: '#241a33',
  insightForeground: '#e2d6f5',
  insightAccent: '#b794f4',
  accentPurple: '#9f7aea',
  accentPurpleForeground: '#16101f',
  accentPurpleSoft: '#2a2038',
  liftShadow: 'rgba(0, 0, 0, 0.55)',
  glassHighlight: 'rgba(255, 255, 255, 0.08)',
  tabBarBg: '#1e1e1e',
  glassCard: 'rgba(30, 30, 30, 0.94)',
  glassSecondary: '#262626',
  glassBorder: '#2c2c2c',
  glassPrimaryFrom: '#9f7aea',
  glassPrimaryTo: '#805ad5',
};

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
};

export const moodGradients: Record<
  'rossz' | 'gyenge' | 'semleges' | 'jo' | 'remek',
  [string, string]
> = {
  rossz: ['rgba(186, 230, 253, 0.35)', 'rgba(199, 210, 254, 0.25)'],
  gyenge: ['rgba(191, 219, 254, 0.3)', 'rgba(221, 214, 254, 0.22)'],
  semleges: ['rgba(237, 228, 251, 0.35)', 'rgba(226, 232, 240, 0.25)'],
  jo: ['rgba(253, 230, 138, 0.28)', 'rgba(237, 228, 251, 0.35)'],
  remek: ['rgba(251, 207, 232, 0.28)', 'rgba(237, 228, 251, 0.4)'],
};

export const treeColors = {
  bright: { color: '#9f7aea', glow: 'rgba(159, 122, 234, 0.65)' },
  neutral: { color: '#805ad5', glow: 'rgba(128, 90, 213, 0.45)' },
  calm: { color: '#4c51bf', glow: 'rgba(76, 81, 191, 0.3)' },
} as const;

const navigationFonts = {
  regular: { fontFamily: 'sans-serif', fontWeight: '400' as const },
  medium: { fontFamily: 'sans-serif-medium', fontWeight: '400' as const },
  bold: { fontFamily: 'sans-serif', fontWeight: '600' as const },
  heavy: { fontFamily: 'sans-serif', fontWeight: '700' as const },
};

export function getNavigationTheme(isDark: boolean, colors: AppColors) {
  return {
    dark: isDark,
    colors: {
      primary: colors.accentPurple,
      background: colors.background,
      card: colors.card,
      text: colors.foreground,
      border: colors.border,
      notification: colors.accentPurple,
    },
    fonts: navigationFonts,
  };
}
