import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Bell,
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
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackgroundWrapper } from '@/components/BackgroundWrapper';
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
import type { AppointmentEntry } from '@/context/HealthLogContext';
import {
  isMedicationDueOn,
  medicationDoseKey,
  toIsoDate,
  useHealthLog,
} from '@/context/HealthLogContext';
import { useFloraScene } from '@/context/FloraSceneContext';
import { useProfile } from '@/context/ProfileContext';
import { DailyGoalCard } from '@/components/home/DailyGoalCard';
import { FloraTipCard } from '@/components/home/FloraTipCard';
import { computeDailyStats } from '@/utils/dailyStats';
import { computeDailyProgress } from '@/utils/dailyTasks';
import { buildFloraTip } from '@/utils/floraTip';
import { missingForTargets } from '@/utils/nutritionTargets';
import { useAppTheme } from '@/context/ThemeContext';
import { useTabBarSpacing } from '@/context/TabBarContext';
import { useTutorialTarget } from '@/context/TutorialContext';

type SheetKind = 'symptoms' | 'meal' | 'workout' | 'medication' | null;

const QUICK_ACTIONS: {
  label: string;
  Icon: typeof Pill;
  modal: Exclude<SheetKind, null>;
  tint: string;
}[] = [
  {
    label: 'Tegnapi napló',
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

const HINT_VISIBLE_MS = 5000;
const HINT_FADE_IN_MS = 260;
const HINT_FADE_OUT_MS = 420;
const HINT_LIFT_PX = 8;
const HEADER_BTN_W = 36;
const HEADER_BTN_GAP = 8;
const HINT_TAIL_W = 14;
// The restore button is the first of three in the header row, so its centre
// sits two buttons plus two gaps in from the right edge.
const HINT_TAIL_RIGHT =
  2 * (HEADER_BTN_W + HEADER_BTN_GAP) + HEADER_BTN_W / 2 - HINT_TAIL_W / 2;

/** Marks a dose whose time has already gone by. */
const OVERDUE = '#FBBF24';

const MONTH_SHORT = [
  'jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.',
  'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.',
];

/** "Ma" and "Holnap" read better than a date this close to now. */
function formatAppointmentDay(appointment: AppointmentEntry, now: Date) {
  const [year, month, day] = appointment.date.split('-').map(Number);
  if (!year || !month || !day) return appointment.date;

  const target = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days === 0) return 'Ma';
  if (days === 1) return 'Holnap';
  return `${MONTH_SHORT[month - 1]} ${day}.`;
}

/** "8:00" and "08:00" both mean the same minute of the day. */
function minutesOfDay(time: string) {
  const [hours, minutes] = time.split(':');
  return Number(hours) * 60 + Number(minutes ?? 0);
}

/**
 * When an appointment falls, as a timestamp. An all-day entry counts as
 * upcoming until that day is over, rather than from midnight.
 */
function appointmentTime(appointment: AppointmentEntry) {
  const [year, month, day] = appointment.date.split('-').map(Number);
  if (!year || !month || !day) return null;
  if (appointment.allDay) {
    return new Date(year, month - 1, day, 23, 59).getTime();
  }
  const [hours, minutes] = (appointment.time ?? '0:00').split(':');
  return new Date(
    year,
    month - 1,
    day,
    Number(hours) || 0,
    Number(minutes) || 0,
  ).getTime();
}

export default function HomeScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const tabBarSpacing = useTabBarSpacing();
  const { profile, updateProfile } = useProfile();
  const { floraHint, hideFloraHint } = useFloraScene();
  const hintOpacity = useSharedValue(0);
  const hintLift = useSharedValue(-HINT_LIFT_PX);
  const hintVisible = profile.floraHidden && floraHint;

  // The node stays mounted for as long as the restore button exists, so the
  // bubble can fade back out instead of being torn off the screen.
  useEffect(() => {
    if (!hintVisible) {
      hintOpacity.value = withTiming(0, { duration: HINT_FADE_OUT_MS });
      hintLift.value = withTiming(-HINT_LIFT_PX, {
        duration: HINT_FADE_OUT_MS,
      });
      return;
    }
    hintOpacity.value = withTiming(1, { duration: HINT_FADE_IN_MS });
    hintLift.value = withSpring(0, { damping: 14, stiffness: 190 });
    const timer = setTimeout(hideFloraHint, HINT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [hideFloraHint, hintLift, hintOpacity, hintVisible]);

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [{ translateY: hintLift.value }],
  }));
  const { isDark, toggleTheme } = useAppTheme();
  const remission = profile.phase === 'remission';

  const { log, takeMedicationDose } = useHealthLog();
  const now = new Date();
  const todayIso = toIsoDate(now);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = toIsoDate(yesterday);
  const yesterdayJournalDone = (log.symptoms[yesterdayIso] ?? []).some(
    (entry) =>
      entry.journalKind === 'yesterday' ||
      entry.bowelMovements !== undefined ||
      entry.medicationCompliance !== undefined,
  );
  // Picking times[0] meant the card still advertised the 8:00 dose at half
  // past nine. Today's doses are walked in order and the first one still
  // outstanding wins, so a missed dose stays on screen -- flagged as late
  // rather than quietly replaced by the next one.
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const takenToday = log.takenDoses?.[todayIso] ?? [];

  const nextDose = log.medications
    .filter(
      (medication) =>
        medication.type !== 'biologic' &&
        medication.times.length > 0 &&
        isMedicationDueOn(medication, now),
    )
    .flatMap((medication) =>
      medication.times.map((time) => ({
        medication,
        time,
        minutes: minutesOfDay(time),
        taken: takenToday.includes(medicationDoseKey(medication.id, time)),
      })),
    )
    .filter((dose) => !dose.taken)
    .sort((a, b) => a.minutes - b.minutes)[0];

  const nextMed = nextDose?.medication;
  const nextMedTime = nextDose?.time ?? '';
  const nextMedLate = nextDose ? nextDose.minutes < nowMinutes : false;

  // The blood draw used to be typed straight into the markup, so it announced
  // the same August date for ever. It comes from the real list now, and only
  // while it is still ahead of us.
  const nextAppointment = log.appointments
    .filter((appointment) => {
      const when = appointmentTime(appointment);
      return when !== null && when >= now.getTime();
    })
    .sort(
      (a, b) => (appointmentTime(a) ?? 0) - (appointmentTime(b) ?? 0),
    )[0];
  const progress = computeDailyProgress(log, now);
  const dailyStats = computeDailyStats(log, profile, now);
  const floraTip = buildFloraTip(profile, log, progress, now);

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const headerTargetRef = useTutorialTarget('dashboard-header');
  const quickTargetRef = useTutorialTarget('quick-actions');

  const router = useRouter();

  // Hiányzó profiladatok finom jelzése
  // The same list the calorie estimate needs, so the two never disagree
  // about what is still outstanding.
  const missingPersonal = missingForTargets(profile);
  const medsMissing =
    log.medications.length === 0 &&
    !log.noMeds;
  const missingAll = medsMissing
    ? [...missingPersonal, 'gyógyszerek']
    : missingPersonal;

  return (
    <BackgroundWrapper variant="dashboard" style={styles.root}>
      <VitalityTree remission={remission} />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: tabBarSpacing,
        }}>
        {/* Fejléc */}
        <View
          ref={headerTargetRef}
          collapsable={false}
          style={styles.headerRow}>
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
            {profile.floraHidden ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Flóra visszahozása"
                onPress={() => {
                  hideFloraHint();
                  updateProfile({ floraHidden: false });
                }}
                style={({ pressed }) => [
                  styles.bellBtn,
                  {
                    backgroundColor: p.dark
                      ? 'rgba(167,139,250,0.28)'
                      : '#F5F3FF',
                    borderColor: p.dark
                      ? 'rgba(167,139,250,0.5)'
                      : '#DDD6FE',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <Sparkles size={17} color={violet[400]} />
              </Pressable>
            ) : null}
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

        {/* Napi cél és Flóra tippje */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20, gap: 12 }}>
          <DailyGoalCard
            stats={dailyStats}
            onOpen={(row) => {
              // Each bar leads to where that number is actually kept.
              if (row === 'journal') setSheet('symptoms');
              else if (row === 'medication') router.push('/schedule');
              else router.push('/lifestyle');
            }}
          />
          <FloraTipCard
            text={floraTip}
            onPress={() => router.push('/chatbot')}
          />
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
            {QUICK_ACTIONS.map((qa) => {
              const journalCompleted =
                qa.modal === 'symptoms' && yesterdayJournalDone;
              return (
                <Pressable
                  key={qa.modal}
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
                    <Text style={styles.qaLabel}>
                      {journalCompleted ? 'Napló szerkesztése' : qa.label}
                    </Text>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Közelgő */}
        {nextAppointment || nextMed ? (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={[styles.sectionLabel, { color: p.muted }]}>
              Közelgő
            </Text>
            <GlassCard style={{ padding: 16 }}>
              {nextAppointment ? (
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
                      {nextAppointment.doctor}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.body,
                        color: p.muted,
                      }}>
                      {nextAppointment.exam}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.display,
                        color: violet[400],
                      }}>
                      {formatAppointmentDay(nextAppointment, now)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.body,
                        color: p.muted,
                      }}>
                      {nextAppointment.allDay
                        ? 'egész nap'
                        : nextAppointment.time}
                    </Text>
                  </View>
                </View>
              ) : null}
              {nextMed ? (
                <View
                  style={[
                    styles.upcomingRow,
                    nextAppointment && {
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
                        color: nextMedLate ? OVERDUE : p.muted,
                      }}>
                      {nextMedLate ? 'Elmaradt' : 'Ma'} {nextMedTime} ·{' '}
                      {nextMed.times.length} időpont
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => takeMedicationDose(nextMed.id, nextMedTime)}
                    style={({ pressed }) => [
                      styles.checkBtn,
                      {
                        backgroundColor: p.chipBg,
                        borderWidth: 1,
                        borderColor: nextMedLate
                          ? OVERDUE
                          : p.dark
                            ? 'rgba(255,255,255,0.15)'
                            : '#E9D5FF',
                      },
                      pressed && { transform: [{ scale: 0.9 }] },
                    ]}>
                    <Circle size={16} color={nextMedLate ? OVERDUE : p.muted} />
                  </Pressable>
                </View>
              ) : null}
            </GlassCard>
          </View>
        ) : null}
      </ScrollView>

      {profile.floraHidden ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.hintWrap, { top: insets.top + 64 }, hintStyle]}>
          <View style={styles.hintTail} />
          <View style={styles.hintBody}>
            <Text style={styles.hintText}>
              Itt megtalálsz! Koppints, és visszajövök.
            </Text>
          </View>
        </Animated.View>
      ) : null}

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
      {profileOpen ? (
        <ProfileModal
          visible
          onClose={() => setProfileOpen(false)}
        />
      ) : null}
    </BackgroundWrapper>
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
  hintWrap: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    zIndex: 50,
  },
  hintTail: {
    width: 0,
    height: 0,
    marginRight: HINT_TAIL_RIGHT,
    borderLeftWidth: HINT_TAIL_W / 2,
    borderRightWidth: HINT_TAIL_W / 2,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(167, 139, 250, 0.55)',
  },
  hintBody: {
    maxWidth: 232,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.55)',
    backgroundColor: 'rgba(24, 12, 46, 0.96)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  hintText: {
    color: '#FFFFFF',
    fontFamily: font.bodyMedium,
    fontSize: 12.5,
    lineHeight: 17,
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
