// 1:1 palette extracted from the Figma prototype bundle (CrohnSync).
export const violet = {
  300: '#C4B5FD',
  400: '#A78BFA',
  500: '#8B5CF6',
  600: '#7C3AED',
  700: '#6D28D9',
} as const;

export const purple = {
  50: '#FAF5FF',
  100: '#F3E8FF',
  200: '#E9D5FF',
  300: '#D8B4FE',
  400: '#C084FC',
  500: '#A855F7',
  600: '#9333EA',
  700: '#7E22CE',
  900: '#4C1D95',
} as const;

export const blue = {
  300: '#93C5FD',
  400: '#60A5FA',
  500: '#3B82F6',
  600: '#2563EB',
} as const;

export const fuchsia400 = '#E879F9';
export const fuchsia500 = '#D946EF';
export const emerald400 = '#34D399';
export const red400 = '#F87171';
export const red500 = '#EF4444';

export type Palette = ReturnType<typeof getPalette>;

export function getPalette(dark: boolean) {
  return {
    dark,
    // App background: dark #0D0A1E / light #F5F0FF
    bg: dark ? '#0D0A1E' : '#F5F0FF',
    sheetBg: dark ? '#160F30' : '#FFFFFF',
    text: dark ? '#FFFFFF' : '#1A0D35',
    muted: dark ? 'rgba(255,255,255,0.5)' : purple[500],
    mutedSoft: dark ? 'rgba(255,255,255,0.4)' : purple[400],
    faint: dark ? 'rgba(255,255,255,0.3)' : purple[300],
    // GlassCard
    glassBg: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.97)',
    glassBorder: dark ? 'rgba(255,255,255,0.26)' : 'rgba(233,213,255,0.85)',
    // Inputs / fields
    fieldBg: dark ? 'rgba(255,255,255,0.05)' : purple[50],
    fieldBgStrong: dark ? 'rgba(255,255,255,0.08)' : purple[50],
    fieldBorder: dark ? 'rgba(255,255,255,0.10)' : purple[100],
    placeholder: dark ? 'rgba(255,255,255,0.25)' : purple[300],
    // Dividers
    divider: dark ? 'rgba(255,255,255,0.08)' : purple[100],
    dividerSoft: dark ? 'rgba(255,255,255,0.06)' : purple[100],
    // Toggle off track
    toggleOff: dark ? 'rgba(255,255,255,0.15)' : purple[200],
    // Small icon buttons
    chipBg: dark ? 'rgba(255,255,255,0.08)' : purple[50],
    // Bottom nav
    navBg: dark ? 'rgba(22,15,48,0.92)' : 'rgba(255,255,255,0.92)',
    navBorder: dark ? 'rgba(167,139,250,0.15)' : 'rgba(124,58,237,0.1)',
    navInactive: dark ? 'rgba(255,255,255,0.4)' : purple[300],
    navLabelInactive: dark ? 'rgba(255,255,255,0.35)' : purple[300],
  };
}

// Profilkép színpárok (gradiens: világos → sötét)
export const AVATAR_COLORS: [string, string][] = [
  ['#8B5CF6', '#6D28D9'],
  ['#6366F1', '#4338CA'],
  ['#D946EF', '#A21CAF'],
  ['#F43F5E', '#BE123C'],
  ['#F59E0B', '#B45309'],
  ['#10B981', '#065F46'],
];

export const font = {
  // Nunito = display / bold headings, Inter = body
  display: 'Nunito_700Bold',
  displayX: 'Nunito_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;
