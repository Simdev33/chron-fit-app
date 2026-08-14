import { darkColors, lightColors } from '@/constants/theme';

export default {
  light: {
    text: lightColors.foreground,
    background: lightColors.background,
    tint: lightColors.accentPurple,
    tabIconDefault: lightColors.mutedForeground,
    tabIconSelected: lightColors.accentPurple,
  },
  dark: {
    text: darkColors.foreground,
    background: darkColors.background,
    tint: darkColors.accentPurple,
    tabIconDefault: darkColors.mutedForeground,
    tabIconSelected: darkColors.accentPurple,
  },
};
