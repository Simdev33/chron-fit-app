import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BookOpenCheck,
  Check,
  Flame,
  Pill,
  UtensilsCrossed,
} from 'lucide-react-native';

import { GlassCard, usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import type { DailyStats } from '@/utils/dailyStats';

const DONE = '#34D399';

type RowKind = 'journal' | 'medication' | 'activeCalories' | 'meals';

function StatBar({
  icon,
  label,
  value,
  ratio,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  /** What the right hand side reads. */
  value: string;
  ratio: number;
  onPress?: () => void;
}) {
  const p = usePalette();
  const complete = ratio >= 1;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [pressed && onPress && { opacity: 0.7 }]}>
      <View style={styles.rowHead}>
        <View style={styles.rowLabel}>
          {icon}
          <Text style={[styles.label, { color: p.text }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text
          style={[styles.value, { color: complete ? DONE : p.muted }]}
          numberOfLines={1}>
          {value}
        </Text>
      </View>

      <View
        style={[
          styles.track,
          {
            backgroundColor: p.dark ? 'rgba(255,255,255,0.10)' : '#EDE9FE',
          },
        ]}>
        {ratio > 0 ? (
          <LinearGradient
            colors={
              complete ? [DONE, '#10B981'] : [violet[400], violet[600]]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.fill,
              { width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` },
            ]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export function DailyGoalCard({
  stats,
  onOpen,
}: {
  stats: DailyStats;
  onOpen?: (row: RowKind) => void;
}) {
  const p = usePalette();
  const iconSize = 14;

  const rows: React.ReactNode[] = [];

  // The journal is the one constant: it is asked of everyone, every day.
  rows.push(
    <StatBar
      key="journal"
      icon={<BookOpenCheck size={iconSize} color={violet[400]} />}
      label="Napi napló"
      value={stats.journalDone ? 'Kész' : 'Kitöltésre vár'}
      ratio={stats.journalDone ? 1 : 0}
      onPress={onOpen ? () => onOpen('journal') : undefined}
    />,
  );

  if (stats.medication) {
    const { current, goal } = stats.medication;
    rows.push(
      <StatBar
        key="medication"
        icon={<Pill size={iconSize} color={violet[400]} />}
        label="Gyógyszerek"
        value={`${current}/${goal}`}
        ratio={goal > 0 ? current / goal : 0}
        onPress={onOpen ? () => onOpen('medication') : undefined}
      />,
    );
  }

  if (stats.activeCalories) {
    const { current, goal } = stats.activeCalories;
    rows.push(
      <StatBar
        key="active"
        icon={<Flame size={iconSize} color={violet[400]} />}
        label="Aktív kalória"
        value={`${current} / ${goal} kcal`}
        ratio={goal > 0 ? current / goal : 0}
        onPress={onOpen ? () => onOpen('activeCalories') : undefined}
      />,
    );
  }

  if (stats.meals) {
    const { current, goal } = stats.meals;
    rows.push(
      <StatBar
        key="meals"
        icon={<UtensilsCrossed size={iconSize} color={violet[400]} />}
        label="Étkezés"
        // Reads the same way as the active calorie row, and the actual
        // numbers say more here than a percentage does.
        value={`${current.toLocaleString('hu-HU')} / ${goal.toLocaleString(
          'hu-HU',
        )} kcal`}
        ratio={goal > 0 ? current / goal : 0}
        onPress={onOpen ? () => onOpen('meals') : undefined}
      />,
    );
  }

  const allDone =
    stats.journalDone &&
    (!stats.medication ||
      stats.medication.current >= stats.medication.goal) &&
    (!stats.activeCalories ||
      stats.activeCalories.current >= stats.activeCalories.goal);

  return (
    <GlassCard style={{ padding: 16 }}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: p.text }]}>Napi cél</Text>
        {allDone ? (
          <View style={styles.doneChip}>
            <Check size={11} color={DONE} strokeWidth={3} />
            <Text style={[styles.doneLabel, { color: DONE }]}>
              Szép munka!
            </Text>
          </View>
        ) : null}
      </View>

      {/* The card is only as tall as it has rows to show. */}
      <View style={{ gap: 12 }}>{rows}</View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  title: {
    fontFamily: font.display,
    fontSize: 16,
  },
  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(52,211,153,0.14)',
  },
  doneLabel: {
    fontFamily: font.bodySemi,
    fontSize: 10,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: font.bodyMedium,
    fontSize: 13,
    flexShrink: 1,
  },
  value: {
    fontFamily: font.bodySemi,
    fontSize: 12,
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
