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
import { Sparkles, Trash2 } from 'lucide-react-native';

import { GlassCard, usePalette } from '@/components/figma/ui';
import { WorkoutCalendar } from '@/components/fitness/WorkoutCalendar';
import { WorkoutDayCard } from '@/components/fitness/WorkoutDayCard';
import { font, violet } from '@/constants/figma';
import { toIsoDate, useHealthLog } from '@/context/HealthLogContext';
import { useProfile } from '@/context/ProfileContext';
import { buildUserContext } from '@/utils/buildUserContext';
import { confirmDestructive } from '@/utils/confirmDialog';
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

export function FitnessPlanner() {
  const p = usePalette();
  const { profile } = useProfile();
  const { log, saveWorkoutPlan } = useHealthLog();

  const todayIso = toIsoDate(new Date());
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
              <WorkoutDayCard
                key={day.id}
                day={day}
                dateIso={todayIso}
              />
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
});
