import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Check,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react-native';

import { GlassCard, usePalette } from '@/components/figma/ui';
import {
  KIND_COLOR,
  KIND_LABEL,
  WorkoutCalendar,
} from '@/components/fitness/WorkoutCalendar';
import { font, violet } from '@/constants/figma';
import { toIsoDate, useHealthLog } from '@/context/HealthLogContext';
import { useProfile } from '@/context/ProfileContext';
import type {
  PlannedDay,
  PlannedExercise,
  WorkoutDayKind,
} from '@/types/workoutPlan';
import { buildUserContext } from '@/utils/buildUserContext';
import { confirmDestructive } from '@/utils/confirmDialog';
import { resolveTracking } from '@/utils/exerciseTracking';
import { planWorkout } from '@/utils/planWorkout';

const WEEKDAY_FULL = [
  'Hétfő',
  'Kedd',
  'Szerda',
  'Csütörtök',
  'Péntek',
  'Szombat',
  'Vasárnap',
];

/** Destructive actions read as destructive before they are tapped. */
const DANGER = '#F87171';
const DANGER_BG = 'rgba(248,113,113,0.12)';

const EXAMPLES = [
  'Heti 3 súlyzós edzést kérek, fókuszban a láb, a pihenőnapokon egy kis kardióval.',
  'Most fáradt vagyok, csak könnyű mozgást szeretnék a héten.',
  'Otthon edzenék, eszköz nélkül, napi 20 percben.',
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

function DayCard({ day }: { day: PlannedDay }) {
  const p = usePalette();
  const { log, completeWorkoutDay, uncompleteWorkoutDay } = useHealthLog();
  const [open, setOpen] = useState(false);

  const todayIso = toIsoDate(new Date());
  const doneToday = (log.completedWorkouts[todayIso] ?? []).some(
    (entry) => entry.planDayId === day.id,
  );

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

        {doneToday ? (
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
              locked={doneToday}
            />
          ))}

          <Pressable
            onPress={() =>
              doneToday
                ? uncompleteWorkoutDay(day.id, todayIso)
                : completeWorkoutDay(day, todayIso)
            }
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.doneBtn,
              doneToday
                ? { backgroundColor: p.chipBg, borderColor: accent }
                : { borderColor: 'transparent' },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}>
            {doneToday ? (
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
        </View>
      ) : null}
    </GlassCard>
  );
}

export function FitnessPlanner() {
  const p = usePalette();
  const { profile } = useProfile();
  const { log, saveWorkoutPlan } = useHealthLog();

  const [prompt, setPrompt] = useState('');
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = log.workoutPlan;

  const discard = () => {
    confirmDestructive({
      title: 'Terv törlése',
      message:
        'A heti terv és a hozzá beírt ismétlések, súlyok törlődnek. Az elvégzettnek jelölt edzések a naptárban megmaradnak.',
      onConfirm: () => saveWorkoutPlan(null),
    });
  };

  const submit = async (text?: string) => {
    const request = (text ?? prompt).trim();
    if (!request || planning) return;

    setPlanning(true);
    setError(null);
    try {
      // The brief asks for the IBD status to reach the model without the UI
      // asking again, so it is assembled from the profile the user already
      // filled in -- the same context Flóra gets.
      const next = await planWorkout(request, buildUserContext(profile));
      saveWorkoutPlan(next);
      setPrompt('');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'A tervezés nem sikerült. Próbáld újra.',
      );
    } finally {
      setPlanning(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 20, gap: 20 }}>
      <View>
        <Text style={[styles.sectionLabel, { color: p.muted }]}>
          Edzésnaptár
        </Text>
        <WorkoutCalendar />
      </View>

      <View>
        <Text style={[styles.sectionLabel, { color: p.muted }]}>
          Mit szeretnél a héten?
        </Text>
        <GlassCard style={{ padding: 16, gap: 12 }}>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            editable={!planning}
            multiline
            placeholder="Pl. heti 3 súlyzós edzést kérek, fókuszban a láb…"
            placeholderTextColor={p.placeholder}
            style={[
              styles.promptInput,
              {
                backgroundColor: p.fieldBg,
                borderColor: p.fieldBorder,
                color: p.text,
              },
            ]}
          />

          {!planning && prompt.trim().length === 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={[styles.exampleHint, { color: p.faint }]}>
                {plan
                  ? 'Írj újat, vagy koppints egy ötletre — az új terv felváltja a mostanit.'
                  : 'Vagy koppints egy ötletre:'}
              </Text>
              {EXAMPLES.map((example) => (
                <Pressable
                  key={example}
                  onPress={() => submit(example)}
                  style={({ pressed }) => [
                    styles.example,
                    { borderColor: p.fieldBorder },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text
                    style={[styles.exampleText, { color: p.muted }]}
                    numberOfLines={2}>
                    {example}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {error ? (
            <Text style={[styles.error, { color: '#F87171' }]}>{error}</Text>
          ) : null}

          <Pressable
            onPress={() => submit()}
            disabled={planning || prompt.trim().length === 0}
            accessibilityRole="button"
            style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
            {planning ? (
              <View
                style={[
                  styles.planBtn,
                  { backgroundColor: p.chipBg, flexDirection: 'row', gap: 8 },
                ]}>
                <ActivityIndicator size="small" color={violet[400]} />
                <Text style={[styles.planLabel, { color: p.muted }]}>
                  Tervezés folyamatban…
                </Text>
              </View>
            ) : (
              <LinearGradient
                colors={[violet[600], violet[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.planBtn,
                  prompt.trim().length === 0 && { opacity: 0.45 },
                ]}>
                <Sparkles size={15} color="#fff" />
                <Text style={[styles.planLabel, { color: '#fff' }]}>
                  {plan ? 'Új terv kérése' : 'Terv készítése'}
                </Text>
              </LinearGradient>
            )}
          </Pressable>
        </GlassCard>
      </View>

      {plan ? (
        <View>
          <View style={styles.planHead}>
            <Text
              style={[
                styles.sectionLabel,
                { color: p.muted, marginBottom: 0 },
              ]}>
              A heted
            </Text>
            <Pressable
              onPress={discard}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Terv törlése"
              style={({ pressed }) => [
                styles.discard,
                { borderColor: DANGER, backgroundColor: DANGER_BG },
                pressed && { opacity: 0.6 },
              ]}>
              <Trash2 size={13} color={DANGER} />
              <Text style={[styles.discardLabel, { color: DANGER }]}>
                Terv törlése
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: 12 }}>
            {plan.summary ? (
              <Text style={[styles.summary, { color: p.muted }]}>
                {plan.summary}
              </Text>
            ) : null}
            {plan.days.map((day) => (
              <DayCard key={day.id} day={day} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  promptInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 14,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  example: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  exampleText: {
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 17,
  },
  exampleHint: {
    fontFamily: font.body,
    fontSize: 11,
    marginBottom: 2,
  },
  error: {
    fontFamily: font.body,
    fontSize: 12,
  },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  planLabel: {
    fontFamily: font.display,
    fontSize: 14,
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  discard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  discardLabel: {
    fontFamily: font.bodySemi,
    fontSize: 11,
  },
  summary: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
  },
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
});
