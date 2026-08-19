import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { Palette, font, getPalette, violet } from '@/constants/figma';
import type { SupplementEntry } from '@/context/ProfileContext';
import { useAppTheme } from '@/context/ThemeContext';

export function usePalette(): Palette {
  const { isDark } = useAppTheme();
  return getPalette(isDark);
}

/**
 * Androidon az áttetsző státuszsávú Modal nem méretezi át magát a
 * billentyűzet megjelenésekor, ezért kézzel követjük a magasságát.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = React.useState(0);
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** Figma GlassCard: bg-white/5 border-white/10 rounded-2xl (dark). */
export function GlassCard({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
}) {
  const p = usePalette();
  const base: ViewStyle = {
    backgroundColor: p.glassBg,
    borderWidth: 1,
    borderColor: p.glassBorder,
    borderRadius: 16,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          base,
          style,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

/** Figma BottomSheet: rounded-t-3xl, handle, title, X button. */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const p = usePalette();
  const keyboardHeight = useKeyboardHeight();
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={sheetStyles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          // flex:1 gives the sheet a parent with a real height, without which
          // its percentage maxHeight is silently dropped and the sheet grows
          // past the top of the screen, taking the close button with it.
          // box-none keeps the empty area above it tapping through to the
          // backdrop, so tap-to-close still works.
          pointerEvents="box-none"
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            paddingBottom: keyboardHeight,
          }}>
          <View
            style={[
              sheetStyles.sheet,
              {
                backgroundColor: p.sheetBg,
                borderColor: p.dark ? 'rgba(255,255,255,0.1)' : '#F3E8FF',
              },
            ]}>
            <View style={sheetStyles.headerRow}>
              <View
                style={[
                  sheetStyles.handle,
                  {
                    backgroundColor: p.dark
                      ? 'rgba(255,255,255,0.2)'
                      : '#E9D5FF',
                  },
                ]}
              />
              <Text
                style={[sheetStyles.title, { color: p.text }]}
                numberOfLines={1}>
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                style={[
                  sheetStyles.close,
                  {
                    backgroundColor: p.dark
                      ? 'rgba(255,255,255,0.1)'
                      : '#F3E8FF',
                  },
                ]}>
                <X
                  size={16}
                  color={p.dark ? 'rgba(255,255,255,0.6)' : '#C084FC'}
                />
              </Pressable>
            </View>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    // A transparent backdrop left the tab bar looking live while the modal
    // swallowed its taps, which reads as the app being frozen.
    backgroundColor: 'rgba(8, 3, 18, 0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  handle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    width: 40,
    height: 4,
    borderRadius: 999,
    transform: [{ translateX: -2 }],
  },
  title: { fontFamily: font.display, fontSize: 18 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Figma toggle pill (w-12 h-6, white knob). */
export function TogglePill({
  value,
  onChange,
  onColor = violet[600],
  large,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  onColor?: string;
  large?: boolean;
}) {
  const p = usePalette();
  const w = large ? 56 : 48;
  const h = large ? 28 : 24;
  const knob = large ? 24 : 20;
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{
        width: w,
        height: h,
        borderRadius: 999,
        backgroundColor: value ? onColor : p.toggleOff,
        justifyContent: 'center',
      }}>
      <View
        style={{
          position: 'absolute',
          top: 2,
          left: value ? w - knob - 2 : 2,
          width: knob,
          height: knob,
          borderRadius: 999,
          backgroundColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </Pressable>
  );
}

/** Section header used across the extended profile screen. */
export function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const p = usePalette();
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: p.dividerSoft,
      }}>
      <Text
        style={{
          fontFamily: font.bodySemi,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: p.dark ? violet[400] : violet[600],
        }}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontFamily: font.body,
            fontSize: 12,
            marginTop: 2,
            color: p.dark ? 'rgba(255,255,255,0.4)' : '#C084FC',
          }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Tag input with add button + removable chips (Figma TagInput). */
export function TagInput({
  tags,
  setTags,
  placeholder,
  noneLabel,
  noneActive,
  onNoneChange,
}: {
  tags: string[];
  setTags: (next: string[]) => void;
  placeholder: string;
  noneLabel?: string;
  noneActive?: boolean;
  onNoneChange?: (active: boolean) => void;
}) {
  const p = usePalette();
  const [draft, setDraft] = React.useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || tags.includes(v)) return;
    onNoneChange?.(false);
    setTags([...tags, v]);
    setDraft('');
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={placeholder}
          placeholderTextColor={p.placeholder}
          style={{
            flex: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            fontFamily: font.body,
            color: p.text,
            backgroundColor: p.fieldBgStrong,
            borderWidth: 1,
            borderColor: p.fieldBorder,
          }}
        />
        <Pressable
          onPress={add}
          style={({ pressed }) => ({
            paddingHorizontal: 16,
            justifyContent: 'center',
            borderRadius: 12,
            backgroundColor: violet[600],
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}>
          <Text
            style={{ color: '#fff', fontFamily: font.display, fontSize: 14 }}>
            Hozzáad
          </Text>
        </Pressable>
      </View>
      {tags.length > 0 && !noneActive ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tags.map((t) => (
            <View
              key={t}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                backgroundColor: p.dark
                  ? 'rgba(139,92,246,0.15)'
                  : '#F5F3FF',
                borderColor: p.dark ? 'rgba(139,92,246,0.3)' : '#DDD6FE',
              }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: font.bodySemi,
                  color: p.dark ? violet[300] : violet[700],
                }}>
                {t}
              </Text>
              <Pressable onPress={() => setTags(tags.filter((x) => x !== t))}>
                <X
                  size={11}
                  color={p.dark ? violet[300] : violet[700]}
                  style={{ opacity: 0.6 }}
                />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {noneLabel ? (
        <Pressable
          onPress={() => {
            const next = !noneActive;
            if (next) setTags([]);
            onNoneChange?.(next);
          }}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1.5,
            backgroundColor: noneActive
              ? p.dark
                ? 'rgba(139,92,246,0.28)'
                : '#EDE9FE'
              : 'transparent',
            borderColor: noneActive
              ? violet[500]
              : p.dark
                ? 'rgba(255,255,255,0.18)'
                : '#E9D5FF',
            opacity: pressed ? 0.7 : 1,
          })}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: font.bodySemi,
              color: noneActive
                ? p.dark
                  ? violet[300]
                  : violet[700]
                : p.muted,
            }}>
            {noneActive ? '✓  ' : ''}
            {noneLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function toIsoMonth(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
}

function formatHuMonth(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });
}

const MONTH_LABELS = [
  'jan.',
  'febr.',
  'márc.',
  'ápr.',
  'máj.',
  'jún.',
  'júl.',
  'aug.',
  'szept.',
  'okt.',
  'nov.',
  'dec.',
];

/**
 * Tag lista kötelező „mikortól szedi” dátummal (gyógyszerek, vitaminok stb.).
 */
export function DatedTagInput({
  tags,
  setTags,
  placeholder,
  noneLabel,
  noneActive,
  onNoneChange,
}: {
  tags: SupplementEntry[];
  setTags: (next: SupplementEntry[]) => void;
  placeholder: string;
  noneLabel?: string;
  noneActive?: boolean;
  onNoneChange?: (active: boolean) => void;
}) {
  const p = usePalette();
  const [draft, setDraft] = React.useState('');
  const [pendingName, setPendingName] = React.useState<string | null>(null);
  const [year, setYear] = React.useState<number | null>(null);
  const [month, setMonth] = React.useState<number | null>(null);

  const now = React.useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const years = React.useMemo(
    () => Array.from({ length: 40 }, (_, i) => currentYear - i),
    [currentYear],
  );

  const sinceIso =
    year !== null && month !== null ? toIsoMonth(year, month) : null;

  const startAdd = () => {
    const v = draft.trim();
    if (!v) return;
    if (tags.some((t) => t.name.toLowerCase() === v.toLowerCase())) return;
    onNoneChange?.(false);
    setPendingName(v);
    setYear(null);
    setMonth(null);
    setDraft('');
  };

  const cancelPending = () => {
    setPendingName(null);
    setYear(null);
    setMonth(null);
  };

  const confirmPending = () => {
    if (!pendingName || !sinceIso) return;
    setTags([...tags, { name: pendingName, since: sinceIso }]);
    cancelPending();
  };

  const selectYear = (y: number) => {
    setYear(y);
    if (month !== null && y === currentYear && month > currentMonth) {
      setMonth(null);
    }
  };

  const chip = (
    label: string,
    active: boolean,
    onPress: () => void,
    disabled?: boolean,
  ) => (
    <Pressable
      key={label}
      disabled={disabled}
      onPress={onPress}
      style={{ opacity: disabled ? 0.35 : 1 }}>
      {active ? (
        <LinearGradient
          colors={[violet[600], violet[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={datedStyles.chip}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: font.display,
              color: '#fff',
            }}>
            {label}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            datedStyles.chip,
            {
              backgroundColor: p.fieldBgStrong,
              borderWidth: 1,
              borderColor: p.fieldBorder,
            },
          ]}>
          <Text
            style={{
              fontSize: 13,
              fontFamily: font.display,
              color: p.text,
            }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={{ gap: 8 }}>
      {!pendingName ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={startAdd}
            placeholder={placeholder}
            placeholderTextColor={p.placeholder}
            editable={!noneActive}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              fontFamily: font.body,
              color: p.text,
              backgroundColor: p.fieldBgStrong,
              borderWidth: 1,
              borderColor: p.fieldBorder,
              opacity: noneActive ? 0.5 : 1,
            }}
          />
          <Pressable
            onPress={startAdd}
            disabled={noneActive}
            style={({ pressed }) => ({
              paddingHorizontal: 16,
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: violet[600],
              opacity: noneActive ? 0.5 : pressed ? 0.85 : 1,
              transform: [{ scale: pressed && !noneActive ? 0.95 : 1 }],
            })}>
            <Text
              style={{ color: '#fff', fontFamily: font.display, fontSize: 14 }}>
              Hozzáad
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={{
            gap: 10,
            padding: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: violet[500],
            backgroundColor: p.dark
              ? 'rgba(139,92,246,0.12)'
              : 'rgba(139,92,246,0.08)',
          }}>
          <Text
            style={{
              fontFamily: font.display,
              fontSize: 14,
              color: p.text,
            }}>
            {pendingName}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: font.bodySemi,
              color: p.muted,
            }}>
            Mióta szedi a készítményt? *
          </Text>

          <Text
            style={{
              fontSize: 11,
              fontFamily: font.bodySemi,
              color: p.muted,
            }}>
            Év
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {years.map((y) => chip(String(y), year === y, () => selectYear(y)))}
          </ScrollView>

          <Text
            style={{
              fontSize: 11,
              fontFamily: font.bodySemi,
              color: p.muted,
            }}>
            Hónap
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {MONTH_LABELS.map((label, idx) =>
              chip(
                label,
                month === idx,
                () => setMonth(idx),
                year === currentYear && idx > currentMonth,
              ),
            )}
          </ScrollView>

          {sinceIso ? (
            <Text
              style={{
                fontSize: 12,
                fontFamily: font.body,
                color: violet[400],
              }}>
              Kiválasztva: {formatHuMonth(sinceIso)}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={cancelPending}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: p.fieldBorder,
              }}>
              <Text
                style={{
                  fontFamily: font.bodySemi,
                  fontSize: 13,
                  color: p.muted,
                }}>
                Mégse
              </Text>
            </Pressable>
            <Pressable
              onPress={confirmPending}
              disabled={!sinceIso}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: sinceIso ? violet[600] : p.fieldBgStrong,
                opacity: sinceIso ? 1 : 0.5,
              }}>
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 13,
                  color: sinceIso ? '#fff' : p.faint,
                }}>
                Mentés
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {tags.length > 0 && !noneActive ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tags.map((t) => (
            <View
              key={`${t.name}-${t.since}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                backgroundColor: p.dark
                  ? 'rgba(139,92,246,0.15)'
                  : '#F5F3FF',
                borderColor: p.dark ? 'rgba(139,92,246,0.3)' : '#DDD6FE',
              }}>
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: font.bodySemi,
                    color: p.dark ? violet[300] : violet[700],
                  }}>
                  {t.name}
                </Text>
                {t.since ? (
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: font.body,
                      color: p.muted,
                    }}>
                    {formatHuMonth(t.since)} óta
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() =>
                  setTags(tags.filter((x) => x.name !== t.name || x.since !== t.since))
                }>
                <X
                  size={11}
                  color={p.dark ? violet[300] : violet[700]}
                  style={{ opacity: 0.6 }}
                />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {noneLabel ? (
        <Pressable
          onPress={() => {
            const next = !noneActive;
            if (next) {
              setTags([]);
              cancelPending();
            }
            onNoneChange?.(next);
          }}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1.5,
            backgroundColor: noneActive
              ? p.dark
                ? 'rgba(139,92,246,0.28)'
                : '#EDE9FE'
              : 'transparent',
            borderColor: noneActive
              ? violet[500]
              : p.dark
                ? 'rgba(255,255,255,0.18)'
                : '#E9D5FF',
            opacity: pressed ? 0.7 : 1,
          })}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: font.bodySemi,
              color: noneActive
                ? p.dark
                  ? violet[300]
                  : violet[700]
                : p.muted,
            }}>
            {noneActive ? '✓  ' : ''}
            {noneLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const datedStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/** Barátságos üres állapot listákhoz: emoji + cím + magyarázat. */
export function EmptyState({
  emoji,
  title,
  text,
}: {
  emoji: string;
  title: string;
  text: string;
}) {
  const p = usePalette();
  return (
    <GlassCard style={{ padding: 20, alignItems: 'center' }}>
      <Text style={{ fontSize: 30, marginBottom: 8 }}>{emoji}</Text>
      <Text
        style={{
          fontFamily: font.display,
          fontSize: 15,
          color: p.text,
          marginBottom: 4,
          textAlign: 'center',
        }}>
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          lineHeight: 19,
          fontFamily: font.body,
          color: p.muted,
          textAlign: 'center',
        }}>
        {text}
      </Text>
    </GlassCard>
  );
}
