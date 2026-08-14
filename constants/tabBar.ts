import { type ViewStyle } from 'react-native';

import type { AppColors } from '@/constants/theme';
import { radius } from '@/constants/theme';

export function getTabBarStyle(
  colors: AppColors,
  isDark: boolean,
  bottomInset = 0,
): ViewStyle {
  return {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Math.max(bottomInset, 8),
    height: 64,
    borderRadius: radius['3xl'],
    borderTopWidth: 0,
    backgroundColor: colors.tabBarBg,
    borderWidth: 1,
    borderColor: isDark ? '#2c2c2c' : '#e6e9e8',
    shadowColor: colors.liftShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
    paddingBottom: 8,
    paddingTop: 8,
  };
}
