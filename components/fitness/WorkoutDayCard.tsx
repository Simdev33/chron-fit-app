import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronDown, RotateCcw } from 'lucide-react-native';

import { KIND_COLOR, KIND_LABEL } from '@/constants/workoutKind';
import { GlassCard, usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import { toIsoDate, useHealthLog } from '@/context/HealthLogContext';
import type {
  PlannedDay,
  PlannedExercise,
  WorkoutDayKind,
} from '@/types/workoutPlan';
import { resolveTracking } from '@/utils/exerciseTracking';

const WEEKDAY_FULL = [
  'Hétfő',
  'Kedd',
  'Szerda',
  'Csütörtök',
  'Péntek',
  'Szombat',
  'Vasárnap',
];

/** One numeric box; which ones appear depends on the exercise. */
function ResultField({
  label,
  value,
  onChange,
  locked,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  locked: boolean;
  decimal?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={styles.inputWrap}>
      <Text style={[styles.inputLabel, { color: p.faint }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!locked}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholder="–"
        placeholderTextColor={p.placeholder}
        style={[
          styles.input,
          {
            backgroundColor: p.fieldBg,
            borderColor: p.fieldBorder,
            color: p.text,
            opacity: locked ? 0.6 : 1,
          },
        ]}
      />
    </View>
  );
}

function ExerciseRow({
  exercise,
  kind,
  locked,
}: {
  exercise: PlannedExercise;
  kind: WorkoutDayKind;
  locked: boolean;
}) {
  const p = usePalette();
  const { log, setExerciseResult } = useHealthLog();
  const stored = log.exerciseLog[exercise.id] ?? {
    reps: '',
    weightKg: '',
    minutes: '',
  };

  // Offering reps and kilos next to a walk just left two boxes nobody could
  // fill in. What is worth recording comes from the exercise itself.
  const track = resolveTracking(exercise, kind);

  const update = (patch: Partial<typeof stored>) => {
    setExerciseResult(exercise.id, { ...stored, ...patch });
  };

  return (
    <View style={[styles.exercise, { borderTopColor: p.dividerSoft }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.exerciseName, { color: p.text }]}>
          {exercise.name}
        </Text>
        <Text style={[styles.exerciseMeta, { color: p.muted }]}>
          {track === 'duration'
            ? exercise.reps
            : `${exercise.sets} sorozat · ${exercise.reps} ismétlés`}
        </Text>
        {exercise.note ? (
          <Text style={[styles.exerciseNote, { color: p.mutedSoft }]}>
            {exercise.note}
          </Text>
        ) : null}
      </View>

      <View style={styles.inputs}>
        {track === 'duration' ? (
          <ResultField
            label="perc"
            value={stored.minutes}
            onChange={(minutes) => update({ minutes })}
            locked={locked}
          />
        ) : (
          <>
            <ResultField
              label="ism."
              value={stored.reps}
              onChange={(reps) => update({ reps })}
              locked={locked}
            />
            {track === 'reps-weight' ? (
              <ResultField
                label="kg"
                value={stored.weightKg}
                onChange={(weightKg) => update({ weightKg })}
                locked={locked}
                decimal
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

export function WorkoutDayCard({
  day,
  dateIso,
  defaultOpen = false,
}: {
  day: PlannedDay;
  /**
   * Which date the tick applies to. The planner marks today; the calendar
   * marks whichever day is selected, so a workout can be logged after the
   * fact rather than only on the day itself.
   */
  dateIso: string;
  defaultOpen?: boolean;
}) {
  const p = usePalette();
  const { log, completeWorkoutDay, uncompleteWorkoutDay } = useHealthLog();
  const [open, setOpen] = useState(defaultOpen);

  const done = (log.completedWorkouts[dateIso] ?? []).some(
    (entry) => entry.planDayId === day.id,
  );
  // Ticking off something that has not happened yet would put a false entry
  // in the history, so a day still ahead can be read but not logged.
  const inFuture = dateIso > toIsoDate(new Date());

  const accent = KIND_COLOR[day.kind];
  const isRest = day.kind === 'rest';

  return (
    <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        disabled={isRest}
        accessibilityRole="button"
        style={({ pressed }) => [styles.dayHead, pressed && { opacity: 0.8 }]}>
        <View style={[styles.kindBar, { backgroundColor: accent }]} />

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.dayWeekday, { color: p.muted }]}>
            {WEEKDAY_FULL[day.weekday] ?? ''}
          </Text>
          <Text style={[styles.dayTitle, { color: p.text }]}>{day.title}</Text>
          <Text style={[styles.dayMeta, { color: p.muted }]} numberOfLines={2}>
            {KIND_LABEL[day.kind]}
            {day.durationMin ? ` · ${day.durationMin} perc` : ''}
            {day.focus ? ` · ${day.focus}` : ''}
          </Text>
        </View>

        {done ? (
          <View style={[styles.doneBadge, { borderColor: accent }]}>
            <Check size={12} color={accent} strokeWidth={3} />
          </View>
        ) : null}

        {!isRest ? (
          <ChevronDown
            size={16}
            color={p.muted}
            style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
          />
        ) : null}
      </Pressable>

      {open && !isRest ? (
        <View style={styles.dayBody}>
          {day.exercises.map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              kind={day.kind}
              locked={done}
            />
          ))}

          {inFuture && !done ? (
            <Text style={[styles.futureNote, { color: p.mutedSoft }]}>
              Ez a nap még előtted van.
            </Text>
          ) : (
          <Pressable
            onPress={() =>
              done
                ? uncompleteWorkoutDay(day.id, dateIso)
                : completeWorkoutDay(day, dateIso)
            }
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.doneBtn,
              done
                ? { backgroundColor: p.chipBg, borderColor: accent }
                : { borderColor: 'transparent' },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}>
            {done ? (
              <>
                <RotateCcw size={14} color={p.text} />
                <Text style={[styles.doneLabel, { color: p.text }]}>
                  Mégsem végeztem el
                </Text>
              </>
            ) : (
              <LinearGradient
                colors={[violet[600], violet[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.doneGradient}>
                <Check size={14} color="#fff" strokeWidth={3} />
                <Text style={[styles.doneLabel, { color: '#fff' }]}>
                  Edzés elvégezve
                </Text>
              </LinearGradient>
            )}
          </Pressable>
          )}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  kindBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  dayWeekday: {
    fontFamily: font.bodySemi,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dayTitle: {
    fontFamily: font.display,
    fontSize: 15,
    marginTop: 1,
  },
  dayMeta: {
    fontFamily: font.body,
    fontSize: 12,
    marginTop: 2,
  },
  doneBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  exercise: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  exerciseName: {
    fontFamily: font.bodySemi,
    fontSize: 13,
  },
  exerciseMeta: {
    fontFamily: font.body,
    fontSize: 11,
    marginTop: 2,
  },
  exerciseNote: {
    fontFamily: font.body,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  inputs: {
    flexDirection: 'row',
    gap: 6,
  },
  inputWrap: {
    alignItems: 'center',
    gap: 2,
  },
  inputLabel: {
    fontFamily: font.bodySemi,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  input: {
    width: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    textAlign: 'center',
    fontFamily: font.bodySemi,
    fontSize: 13,
  },
  doneBtn: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
  },
  doneGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  doneLabel: {
    fontFamily: font.display,
    fontSize: 14,
  },
  futureNote: {
    fontFamily: font.body,
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
});
