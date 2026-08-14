import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Dumbbell,
  Moon,
  Pill,
  Settings,
  Sparkles,
  Stethoscope,
  Sun,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIChatModal } from '@/components/figma/AIChatModal';
import { ProfileModal } from '@/components/figma/ProfileModal';
import {
  MealSheet,
  MedicationSheet,
  SymptomSheet,
  WorkoutSheet,
} from '@/components/figma/sheets';
import { GlassCard, usePalette } from '@/components/figma/ui';
import { VitalityTree } from '@/components/figma/VitalityTree';
import {
  AVATAR_COLORS,
  blue,
  font,
  fuchsia400,
  violet,
} from '@/constants/figma';
import {
  MOOD_EMOJI,
  MOOD_LABELS,
  toIsoDate,
  useHealthLog,
} from '@/context/HealthLogContext';
import { useProfile } from '@/context/ProfileContext';
import { useAppTheme } from '@/context/ThemeContext';
import { useTutorialTarget } from '@/context/TutorialContext';

// Háttérárnyalatok hangulat szerint (1 = legrosszabb, 5 = legjobb).
// A középső (semleges) érték megegyezik az alap háttérszínnel.
const MOOD_BG_DARK = ['#030208', '#080614', '#0D0A1E', '#171040', '#241A5E'];
const MOOD_BG_LIGHT = ['#C9B5E8', '#DFD2F4', '#F5F0FF', '#FAF7FF', '#FFFFFF'];

type SheetKind = 'symptoms' | 'meal' | 'workout' | 'medication' | null;

const QUICK_ACTIONS: {
  label: string;
  Icon: typeof Pill;
  modal: Exclude<SheetKind, null>;
  tint: string;
}[] = [
  {
    label: 'Tünetek naplózása',
    Icon: Stethoscope,
    modal: 'symptoms',
    tint: 'rgba(124,58,237,0.9)',
  },
  {
    label: 'Étkezés rögzítése',
    Icon: UtensilsCrossed,
    modal: 'meal',
    tint: 'rgba(99,102,241,0.85)',
  },
  {
    label: 'Edzés hozzáadása',
    Icon: Dumbbell,
    modal: 'workout',
    tint: 'rgba(99,102,241,0.85)',
  },
  {
    label: 'Gyógyszer',
    Icon: Pill,
    modal: 'medication',
    tint: 'rgba(192,38,211,0.8)',
  },
];

export default function HomeScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { isDark, toggleTheme } = useAppTheme();
  const remission = profile.phase === 'remission';

  const { log, setMoodForToday, toggleMedicationTaken } = useHealthLog();
  const todayIso = toIsoDate(new Date());
  const mood = log.moods[todayIso] ?? null;
  const nextMed = log.medications[0];
  const nextMedTaken = nextMed
    ? (log.takenDoses?.[todayIso] ?? []).includes(nextMed.id)
    : false;
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const aiTargetRef = useTutorialTarget('home-ai');
  const moodTargetRef = useTutorialTarget('home-mood');
  const quickTargetRef = useTutorialTarget('home-quick');

  const router = useRouter();

  // Hiányzó profiladatok finom jelzése
  const missingPersonal: string[] = [];
  if (!profile.age.trim()) missingPersonal.push('életkor');
  if (!profile.weightKg.trim()) missingPersonal.push('testsúly');
  if (!profile.heightCm.trim()) missingPersonal.push('magasság');
  const medsMissing =
    log.medications.length === 0 &&
    !log.noMeds &&
    profile.prescribedMeds.length === 0 &&
    !profile.noPrescribedMeds;
  const missingAll = medsMissing
    ? [...missingPersonal, 'gyógyszerek']
    : missingPersonal;

  const moodAnim = useRef(new Animated.Value(3)).current;
  useEffect(() => {
    Animated.timing(moodAnim, {
      toValue: mood ?? 3,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [mood, moodAnim]);

  const moodBg = moodAnim.interpolate({
    inputRange: [1, 2, 3, 4, 5],
    outputRange: p.dark ? MOOD_BG_DARK : MOOD_BG_LIGHT,
  });

  return (
    <Animated.View style={[styles.root, { backgroundColor: moodBg }]}>
      <VitalityTree remission={remission} />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 140,
        }}>
        {/* Fejléc */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => setProfileOpen(true)}
            style={({ pressed }) => [
              styles.headerLeft,
              pressed && { transform: [{ scale: 0.95 }] },
            ]}>
            <View>
              <LinearGradient
                colors={
                  AVATAR_COLORS[profile.avatarColorIdx] ?? AVATAR_COLORS[0]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {profile.name[0]?.toUpperCase() ?? 'A'}
                </Text>
              </LinearGradient>
              <View style={[styles.avatarRing, { borderColor: violet[400] }]} />
              <View
                style={[
                  styles.settingsBadge,
                  { borderColor: p.bg, backgroundColor: violet[600] },
                ]}>
                <Settings size={8} color="#fff" />
              </View>
            </View>
            <View>
              <Text
                style={{ fontSize: 12, fontFamily: font.body, color: p.muted }}>
                Jó reggelt,
              </Text>
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 16,
                  color: p.text,
                }}>
                {profile.name}
              </Text>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={toggleTheme}
              style={[
                styles.bellBtn,
                {
                  backgroundColor: p.dark
                    ? 'rgba(255,255,255,0.26)'
                    : 'rgba(255,255,255,0.97)',
                  borderColor: p.dark
                    ? 'rgba(255,255,255,0.3)'
                    : '#F3E8FF',
                },
              ]}>
              {isDark ? (
                <Sun size={17} color={p.muted} />
              ) : (
                <Moon size={17} color={p.muted} />
              )}
            </Pressable>
            <View
              style={[
                styles.bellBtn,
                {
                  backgroundColor: p.dark
                    ? 'rgba(255,255,255,0.26)'
                    : 'rgba(255,255,255,0.97)',
                  borderColor: p.dark
                    ? 'rgba(255,255,255,0.3)'
                    : '#F3E8FF',
                },
              ]}>
              <Bell size={17} color={p.muted} />
              <View style={styles.bellDot} />
            </View>
          </View>
        </View>

        {/* Állapot chip */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View
            style={[
              styles.statusChip,
              {
                backgroundColor: remission
                  ? 'rgba(139,92,246,0.5)'
                  : 'rgba(59,130,246,0.5)',
                borderColor: remission
                  ? 'rgba(139,92,246,0.65)'
                  : 'rgba(59,130,246,0.65)',
              },
            ]}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: remission ? violet[400] : blue[400],
              }}
            />
            <Text
              style={{
                fontSize: 12,
                fontFamily: font.bodySemi,
                color: remission
                  ? p.dark
                    ? violet[300]
                    : violet[700]
                  : p.dark
                    ? blue[300]
                    : blue[600],
              }}>
              {remission
                ? 'Remisszióban'
                : profile.phase === 'flare'
                  ? 'Fellángolás mód'
                  : 'Ismerkedő mód'}
            </Text>
          </View>
        </View>

        {/* Profil kiegészítése — csak amíg hiányzik adat */}
        {missingAll.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <Pressable
              onPress={() =>
                missingPersonal.length > 0
                  ? setProfileOpen(true)
                  : router.push('/schedule')
              }
              style={({ pressed }) =>
                pressed && { transform: [{ scale: 0.98 }] }
              }>
              <GlassCard
                style={{
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}>
                <View style={styles.profileNudgeIcon}>
                  <UserRound size={16} color={violet[400]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: font.display,
                      fontSize: 13,
                      color: p.text,
                    }}>
                    Fejezd be a profilod beállítását
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: font.body,
                      color: p.muted,
                      marginTop: 1,
                    }}>
                    Hiányzik még: {missingAll.join(', ')}
                  </Text>
                </View>
                <ChevronRight size={16} color={p.faint} />
              </GlassCard>
            </Pressable>
          </View>
        )}

        {/* AI kártya */}
        <View
          ref={aiTargetRef}
          collapsable={false}
          style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Pressable
            onPress={() => setChatOpen(true)}
            style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}>
            <LinearGradient
              colors={[
                'rgba(124,58,237,0.95)',
                'rgba(109,40,217,0.8)',
                'rgba(76,29,149,0.7)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.aiCard,
                { borderColor: 'rgba(167,139,250,0.55)' },
              ]}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <LinearGradient
                  colors={[violet[400], violet[600]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.aiIcon}>
                  <Sparkles size={16} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiEyebrow}>AI elemzés · Ma</Text>
                  <Text style={styles.aiBody}>
                    {remission
                      ? 'Az alvási és tüneti adataid alapján a mai nap remek egy könnyű sétához. A CRP-értéked csökkenő trendet mutat — szép munka! 💪'
                      : 'Fellángolás mód aktív. Ma pihenést és kíméletes mozgást javaslok — hidratálj sokat, és kerüld a megerőltető edzést.'}
                  </Text>
                </View>
              </View>
              <View style={styles.aiCta}>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: font.bodySemi,
                    color: violet[300],
                  }}>
                  AI chat megnyitása
                </Text>
                <ChevronRight size={12} color={violet[300]} />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Hangulat */}
        <View
          ref={moodTargetRef}
          collapsable={false}
          style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={[styles.sectionLabel, { color: p.muted }]}>
            Hogy érzed magad ma?
          </Text>
          <GlassCard style={{ padding: 16 }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {MOOD_EMOJI.map((emoji, idx) => {
                const active = mood === idx + 1;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => setMoodForToday(idx + 1)}
                    style={({ pressed }) => [
                      { alignItems: 'center', gap: 4 },
                      pressed && { transform: [{ scale: 0.9 }] },
                    ]}>
                    <Text
                      style={{
                        fontSize: 24,
                        opacity: active ? 1 : 0.6,
                        transform: [{ scale: active ? 1.25 : 1 }],
                      }}>
                      {emoji}
                    </Text>
                    <Text
                      style={{
                        fontSize: 9,
                        fontFamily: font.bodyMedium,
                        color: active ? violet[400] : p.muted,
                      }}>
                      {MOOD_LABELS[idx]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </View>

        {/* Gyors műveletek */}
        <View
          ref={quickTargetRef}
          collapsable={false}
          style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={[styles.sectionLabel, { color: p.muted }]}>
            Gyors műveletek
          </Text>
          <View style={styles.qaGrid}>
            {QUICK_ACTIONS.map((qa) => (
              <Pressable
                key={qa.label}
                onPress={() => setSheet(qa.modal)}
                style={({ pressed }) => [
                  styles.qaItem,
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}>
                <LinearGradient
                  colors={[qa.tint, 'rgba(76,29,149,0.7)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.qaCard,
                    { borderColor: 'rgba(167,139,250,0.5)' },
                  ]}>
                  <qa.Icon size={22} color={violet[300]} />
                  <Text style={styles.qaLabel}>{qa.label}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Közelgő */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={[styles.sectionLabel, { color: p.muted }]}>Közelgő</Text>
          <GlassCard style={{ padding: 16 }}>
            <View style={styles.upcomingRow}>
              <View
                style={[
                  styles.upcomingIcon,
                  { backgroundColor: 'rgba(139,92,246,0.5)' },
                ]}>
                <Clock size={18} color={violet[400]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: font.display,
                    fontSize: 14,
                    color: p.text,
                  }}>
                  Vérvétel
                </Text>
                <Text
                  style={{ fontSize: 12, fontFamily: font.body, color: p.muted }}>
                  CBC · CRP · Kalprotektin
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: font.display,
                    color: violet[400],
                  }}>
                  aug. 16.
                </Text>
                <Text
                  style={{ fontSize: 12, fontFamily: font.body, color: p.muted }}>
                  8:00
                </Text>
              </View>
            </View>
            {nextMed ? (
              <View
                style={[
                  styles.upcomingRow,
                  {
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: p.divider,
                  },
                ]}>
                <View
                  style={[
                    styles.upcomingIcon,
                    { backgroundColor: 'rgba(217,70,239,0.4)' },
                  ]}>
                  <Pill size={18} color={fuchsia400} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: font.display,
                      fontSize: 14,
                      color: p.text,
                    }}>
                    {nextMed.name} {nextMed.dose}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.body,
                      color: p.muted,
                    }}>
                    Ma {nextMed.time} · {nextMed.times}
                  </Text>
                </View>
                <Pressable
                  onPress={() => toggleMedicationTaken(nextMed.id)}
                  style={({ pressed }) => [
                    styles.checkBtn,
                    nextMedTaken
                      ? { backgroundColor: violet[500] }
                      : {
                          backgroundColor: p.chipBg,
                          borderWidth: 1,
                          borderColor: p.dark
                            ? 'rgba(255,255,255,0.15)'
                            : '#E9D5FF',
                        },
                    pressed && { transform: [{ scale: 0.9 }] },
                  ]}>
                  {nextMedTaken ? (
                    <CheckCircle2 size={16} color="#fff" />
                  ) : (
                    <Circle size={16} color={p.muted} />
                  )}
                </Pressable>
              </View>
            ) : null}
          </GlassCard>
        </View>
      </ScrollView>

      <SymptomSheet
        visible={sheet === 'symptoms'}
        onClose={() => setSheet(null)}
      />
      <MealSheet visible={sheet === 'meal'} onClose={() => setSheet(null)} />
      <WorkoutSheet
        visible={sheet === 'workout'}
        onClose={() => setSheet(null)}
      />
      <MedicationSheet
        visible={sheet === 'medication'}
        onClose={() => setSheet(null)}
      />
      <AIChatModal
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        remission={remission}
      />
      {profileOpen ? (
        <ProfileModal
          visible
          onClose={() => setProfileOpen(false)}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: font.display,
    fontSize: 18,
    color: '#fff',
  },
  avatarRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 18,
    borderWidth: 2,
    opacity: 0.6,
  },
  settingsBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: violet[500],
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  aiCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  aiIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiEyebrow: {
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  aiBody: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: font.bodyMedium,
    color: '#fff',
  },
  aiCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  qaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  qaItem: {
    width: '47%',
    flexGrow: 1,
  },
  qaCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  qaLabel: {
    fontFamily: font.display,
    fontSize: 14,
    lineHeight: 18,
    color: '#fff',
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upcomingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileNudgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.25)',
  },
});
