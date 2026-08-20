import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { GlassCard, usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import { toIsoDate, useHealthLog } from '@/context/HealthLogContext';
import type { WorkoutDayKind } from '@/types/workoutPlan';

const WEEKDAY_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const MONTH_NAMES = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
];

export const KIND_COLOR: Record<WorkoutDayKind, string> = {
  strength: '#A78BFA',
  cardio: '#F472B6',
  'active-rest': '#34D399',
  rest: 'rgba(148,163,184,0.7)',
};

export const KIND_LABEL: Record<WorkoutDayKind, string> = {
  strength: 'Súlyzós',
  cardio: 'Kardió',
  'active-rest': 'Aktív pihenő',
  rest: 'Pihenőnap',
};

/** Monday-first, matching how the rest of the app counts weekdays. */
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function startOfWeek(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - mondayIndex(monday));
  return monday;
}

export function WorkoutCalendar() {
  const p = usePalette();
  const { log } = useHealthLog();

  const today = new Date();
  const todayIso = toIsoDate(today);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [selected, setSelected] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + index,
    );
    return { date, iso: toIsoDate(date), label: WEEKDAY_LABELS[index] };
  });

  const shiftWeek = (delta: number) => {
    setSelected(null);
    setWeekStart(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate() + delta * 7,
        ),
    );
  };

  // A week can straddle two months; naming both beats silently picking one.
  const first = days[0].date;
  const last = days[6].date;
  const heading =
    first.getMonth() === last.getMonth()
      ? `${first.getFullYear()}. ${MONTH_NAMES[first.getMonth()]}`
      : `${MONTH_NAMES[first.getMonth()]} – ${MONTH_NAMES[last.getMonth()]}`;

  // The plan is a weekly routine with no dates of its own, so it is laid over
  // the calendar from today onwards. Showing it on past days would claim
  // something happened that never did.
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();

  const plannedFor = (date: Date) => {
    const plan = log.workoutPlan;
    if (!plan || date.getTime() < startOfToday) return null;
    const day = plan.days.find((entry) => entry.weekday === mondayIndex(date));
    return day && day.kind !== 'rest' ? day : null;
  };

  const selectedEntries = selected
    ? (log.completedWorkouts[selected] ?? [])
    : [];
  const selectedPlan = selected
    ? plannedFor(new Date(`${selected}T00:00:00`))
    : null;

  return (
    <GlassCard style={{ padding: 16 }}>
      <View style={styles.calHeader}>
        <Text style={{ fontFamily: font.display, fontSize: 14, color: p.text }}>
          {heading}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable
            onPress={() => shiftWeek(-1)}
            accessibilityRole="button"
            accessibilityLabel="Előző hét"
            style={({ pressed }) => [
              styles.calNav,
              { backgroundColor: p.chipBg },
              pressed && { transform: [{ scale: 0.92 }] },
            ]}>
            <ChevronLeft size={14} color={p.muted} />
          </Pressable>
          <Pressable
            onPress={() => shiftWeek(1)}
            accessibilityRole="button"
            accessibilityLabel="Következő hét"
            style={({ pressed }) => [
              styles.calNav,
              { backgroundColor: p.chipBg },
              pressed && { transform: [{ scale: 0.92 }] },
            ]}>
            <ChevronRight size={14} color={p.muted} />
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 4 }}>
        {days.map((day) => {
          const entries = log.completedWorkouts[day.iso] ?? [];
          const planned = plannedFor(day.date);
          const isToday = day.iso === todayIso;
          const active = day.iso === selected;
          const hasMark = entries.length > 0 || planned !== null;

          const inner = (
            <>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: font.bodyMedium,
                  marginBottom: 4,
                  color: active ? 'rgba(255,255,255,0.7)' : p.muted,
                }}>
                {day.label}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: font.display,
                  color: active ? '#fff' : p.text,
                }}>
                {day.date.getDate()}
              </Text>

              <View style={styles.dots}>
                {entries.length ? (
                  entries.slice(0, 3).map((entry) => (
                    <View
                      key={entry.id}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: active
                            ? '#fff'
                            : KIND_COLOR[entry.kind],
                        },
                      ]}
                    />
                  ))
                ) : planned ? (
                  // Hollow, so a plan never looks like something already done.
                  <View
                    style={[
                      styles.dot,
                      styles.dotPlanned,
                      {
                        borderColor: active
                          ? 'rgba(255,255,255,0.85)'
                          : KIND_COLOR[planned.kind],
                      },
                    ]}
                  />
                ) : null}
              </View>
            </>
          );

          return (
            <Pressable
              key={day.iso}
              onPress={() => setSelected(active || !hasMark ? null : day.iso)}
              accessibilityRole="button"
              accessibilityLabel={`${day.date.getDate()}. ${
                entries.length
                  ? 'volt edzés'
                  : planned
                    ? `tervezve: ${planned.title}`
                    : 'nincs edzés'
              }`}
              style={{ flex: 1 }}>
              {active ? (
                <LinearGradient
                  colors={[violet[600], violet[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.dayCell}>
                  {inner}
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.dayCell,
                    isToday && {
                      borderWidth: 1,
                      borderColor: violet[400],
                    },
                  ]}>
                  {inner}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {selected && (selectedEntries.length || selectedPlan) ? (
        <View style={[styles.detail, { borderTopColor: p.divider }]}>
          {!selectedEntries.length && selectedPlan ? (
            <View style={styles.detailRow}>
              <View
                style={[
                  styles.dot,
                  styles.dotPlanned,
                  { borderColor: KIND_COLOR[selectedPlan.kind], marginTop: 6 },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailTitle, { color: p.text }]}>
                  {selectedPlan.title}
                </Text>
                <Text style={[styles.detailMeta, { color: p.muted }]}>
                  Tervezve · {KIND_LABEL[selectedPlan.kind]}
                  {selectedPlan.durationMin
                    ? ` · ${selectedPlan.durationMin} perc`
                    : ''}
                </Text>
              </View>
            </View>
          ) : null}

          {selectedEntries.map((entry) => (
            <View key={entry.id} style={styles.detailRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: KIND_COLOR[entry.kind], marginTop: 6 },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailTitle, { color: p.text }]}>
                  {entry.title}
                </Text>
                <Text style={[styles.detailMeta, { color: p.muted }]}>
                  {KIND_LABEL[entry.kind]}
                  {entry.durationMin ? ` · ${entry.durationMin} perc` : ''}
                  {entry.results.length
                    ? ` · ${entry.results.length} gyakorlat`
                    : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNav: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    height: 5,
    marginTop: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotPlanned: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  detail: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailTitle: {
    fontFamily: font.bodySemi,
    fontSize: 13,
  },
  detailMeta: {
    fontFamily: font.body,
    fontSize: 11,
    marginTop: 1,
  },
});
