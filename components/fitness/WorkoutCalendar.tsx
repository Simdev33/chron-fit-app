import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

export function WorkoutCalendar() {
  const p = usePalette();
  const { log } = useHealthLog();
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = useState<string | null>(null);

  const todayIso = toIsoDate(today);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = mondayIndex(first);

    // A fixed six-week grid would leave a blank row most months; the length is
    // rounded up to whole weeks instead so the card never has a dangling gap.
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, index) => {
      const dayNumber = index - lead + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      const date = new Date(year, month, dayNumber);
      return {
        dayNumber,
        date,
        iso: toIsoDate(date),
      };
    });
  }, [cursor]);

  const shiftMonth = (delta: number) => {
    setSelected(null);
    setCursor(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  };

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
    const day = plan.days.find(
      (entry) => entry.weekday === mondayIndex(date),
    );
    return day && day.kind !== 'rest' ? day : null;
  };

  const selectedEntries = selected
    ? (log.completedWorkouts[selected] ?? [])
    : [];
  const selectedPlan = selected
    ? (log.workoutPlan?.days.find(
        (entry) =>
          entry.weekday ===
          mondayIndex(new Date(`${selected}T00:00:00`)),
      ) ?? null)
    : null;

  return (
    <GlassCard style={{ padding: 16 }}>
      <View style={styles.head}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Előző hónap"
          style={({ pressed }) => [
            styles.navBtn,
            { backgroundColor: p.chipBg },
            pressed && { transform: [{ scale: 0.92 }] },
          ]}>
          <ChevronLeft size={16} color={p.muted} />
        </Pressable>

        <Text style={[styles.monthLabel, { color: p.text }]}>
          {cursor.getFullYear()}. {MONTH_NAMES[cursor.getMonth()]}
        </Text>

        <Pressable
          onPress={() => shiftMonth(1)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Következő hónap"
          style={({ pressed }) => [
            styles.navBtn,
            { backgroundColor: p.chipBg },
            pressed && { transform: [{ scale: 0.92 }] },
          ]}>
          <ChevronRight size={16} color={p.muted} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={styles.cell}>
            <Text style={[styles.weekLabel, { color: p.faint }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, index) => {
          if (!cell) return <View key={`blank-${index}`} style={styles.cell} />;

          const entries = log.completedWorkouts[cell.iso] ?? [];
          const planned = plannedFor(cell.date);
          const hasMark = entries.length > 0 || planned !== null;
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === selected;

          return (
            <Pressable
              key={cell.iso}
              onPress={() => setSelected(isSelected ? null : cell.iso)}
              disabled={!hasMark}
              accessibilityRole="button"
              accessibilityLabel={`${cell.dayNumber}. ${
                entries.length
                  ? 'volt edzés'
                  : planned
                    ? `tervezve: ${planned.title}`
                    : 'nincs edzés'
              }`}
              style={styles.cell}>
              <View
                style={[
                  styles.day,
                  isToday && { borderColor: violet[400], borderWidth: 1 },
                  isSelected && { backgroundColor: 'rgba(139,92,246,0.25)' },
                ]}>
                <Text
                  style={[
                    styles.dayNumber,
                    {
                      color: hasMark
                        ? p.text
                        : isToday
                          ? violet[400]
                          : p.mutedSoft,
                      fontFamily: entries.length ? font.bodySemi : font.body,
                    },
                  ]}>
                  {cell.dayNumber}
                </Text>

                <View style={styles.dots}>
                  {entries.length ? (
                    entries.slice(0, 3).map((entry) => (
                      <View
                        key={entry.id}
                        style={[
                          styles.dot,
                          { backgroundColor: KIND_COLOR[entry.kind] },
                        ]}
                      />
                    ))
                  ) : planned ? (
                    // Hollow, so a plan never looks like something already done.
                    <View
                      style={[
                        styles.dot,
                        styles.dotPlanned,
                        { borderColor: KIND_COLOR[planned.kind] },
                      ]}
                    />
                  ) : null}
                </View>
              </View>
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
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  navBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.display,
    fontSize: 15,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Seven equal columns rather than fixed widths, so the grid fits any phone.
  cell: {
    width: `${100 / 7}%`,
    padding: 2,
  },
  weekLabel: {
    textAlign: 'center',
    fontFamily: font.bodySemi,
    fontSize: 10,
  },
  day: {
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayNumber: {
    fontSize: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    height: 4,
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
