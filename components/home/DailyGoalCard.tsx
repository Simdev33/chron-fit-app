import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronRight } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

import { GlassCard, usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import type { DailyProgress } from '@/utils/dailyTasks';

const RING = 56;
const STROKE = 6;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const DONE = '#34D399';

const KIND_HINT: Record<DailyProgress['tasks'][number]['kind'], string> = {
  medication: 'Következő: gyógyszer',
  journal: 'Következő: tegnapi napló',
  workout: 'Következő: edzés',
};

export function DailyGoalCard({
  progress,
  onPress,
}: {
  progress: DailyProgress;
  onPress: (task: DailyProgress['next']) => void;
}) {
  const p = usePalette();
  const complete = progress.next === null;
  const colour = complete ? DONE : violet[500];

  return (
    <Pressable
      onPress={() => onPress(progress.next)}
      accessibilityRole="button"
      accessibilityLabel={
        complete
          ? 'Mára minden kész'
          : `${progress.done} kész ${progress.total} teendőből`
      }
      style={({ pressed }) => [pressed && { transform: [{ scale: 0.99 }] }]}>
      <GlassCard style={{ padding: 16 }}>
        <View style={styles.row}>
          <View style={{ width: RING, height: RING }}>
            <Svg width={RING} height={RING}>
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={RADIUS}
                stroke={p.dark ? 'rgba(255,255,255,0.10)' : '#EDE9FE'}
                strokeWidth={STROKE}
                fill="none"
              />
              {progress.ratio > 0 ? (
                <Circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={RADIUS}
                  stroke={colour}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${CIRCUMFERENCE * progress.ratio} ${CIRCUMFERENCE}`}
                  // Start at the top rather than at three o'clock.
                  transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                />
              ) : null}
            </Svg>
            <View style={styles.ringCentre} pointerEvents="none">
              {complete ? (
                <Check size={20} color={DONE} strokeWidth={3} />
              ) : (
                <Text style={[styles.ringValue, { color: p.text }]}>
                  {Math.round(progress.ratio * 100)}
                  <Text style={styles.ringPercent}>%</Text>
                </Text>
              )}
            </View>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: p.text }]}>
              {complete ? 'Szép munka!' : 'Napi cél'}
            </Text>
            <Text style={[styles.subtitle, { color: p.muted }]}>
              {complete
                ? progress.total > 0
                  ? 'Mára mindent kipipáltál.'
                  : 'Mára nincs bejegyzett teendőd.'
                : `${progress.done}/${progress.total} kész · ${
                    progress.next ? KIND_HINT[progress.next.kind] : ''
                  }`}
            </Text>

            {!complete && progress.next ? (
              <Text
                style={[styles.nextLabel, { color: violet[400] }]}
                numberOfLines={1}>
                {progress.next.label}
              </Text>
            ) : null}
          </View>

          {complete ? null : <ChevronRight size={18} color={p.muted} />}
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ringCentre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontFamily: font.displayX,
    fontSize: 16,
  },
  ringPercent: {
    fontSize: 10,
  },
  title: {
    fontFamily: font.display,
    fontSize: 16,
  },
  subtitle: {
    fontFamily: font.body,
    fontSize: 12,
    marginTop: 2,
  },
  nextLabel: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    marginTop: 4,
  },
});
