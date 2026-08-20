import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DayStrip } from '@/components/figma/DayStrip';
import { GlassCard, usePalette } from '@/components/figma/ui';
import { WorkoutDayCard } from '@/components/fitness/WorkoutDayCard';
import { font } from '@/constants/figma';
import { KIND_COLOR, KIND_LABEL } from '@/constants/workoutKind';
import { useHealthLog } from '@/context/HealthLogContext';

/** Monday-first, matching how the rest of the app counts weekdays. */
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

export function WorkoutCalendar() {
  const p = usePalette();
  const { log } = useHealthLog();

  const today = new Date();
  const [selected, setSelected] = useState<string | null>(null);

  // The plan is a weekly routine with no dates of its own, so it is laid over
  // the strip from today onwards. Showing it on past days would claim
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
      <DayStrip
        selectedIso={selected}
        onSelect={(day) => {
          const hasMark =
            (log.completedWorkouts[day.iso] ?? []).length > 0 ||
            plannedFor(day.date) !== null;
          // A day with nothing on it has no detail to open, so tapping it
          // simply closes whatever was showing.
          setSelected(hasMark && day.iso !== selected ? day.iso : null);
        }}
        renderMarker={({ day, active }) => {
          const entries = log.completedWorkouts[day.iso] ?? [];
          const planned = plannedFor(day.date);

          return (
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
          );
        }}
      />

      {selected && (selectedEntries.length || selectedPlan) ? (
        <View style={[styles.detail, { borderTopColor: p.divider }]}>
          {selectedPlan ? (
            // The full card rather than a summary line, so the day can be
            // opened, filled in and ticked off straight from the calendar.
            <WorkoutDayCard
              day={selectedPlan}
              dateIso={selected}
              defaultOpen
            />
          ) : null}

          {selectedEntries
            .filter((entry) => entry.planDayId !== selectedPlan?.id)
            .map((entry) => (
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
