import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import { toIsoDate } from '@/context/HealthLogContext';

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

/** How far either way the strip can be dragged. */
const RANGE_DAYS = 180;
const CELL_W = 44;
const CELL_GAP = 4;
const STRIDE = CELL_W + CELL_GAP;
/** Today starts a little in from the left, so the past is visibly reachable. */
const LEAD_CELLS = 2;

export type DayStripDay = {
  iso: string;
  date: Date;
  label: string;
};

function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

export function DayStrip({
  selectedIso,
  onSelect,
  renderMarker,
}: {
  selectedIso: string | null;
  onSelect: (day: DayStripDay) => void;
  /** Drawn under the date, e.g. workout dots. */
  renderMarker?: (args: {
    day: DayStripDay;
    active: boolean;
  }) => React.ReactNode;
}) {
  const p = usePalette();
  const listRef = useRef<FlatList<DayStripDay>>(null);

  const today = useMemo(() => new Date(), []);
  const todayIso = toIsoDate(today);

  const days = useMemo(() => {
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - RANGE_DAYS,
    );
    return Array.from({ length: RANGE_DAYS * 2 + 1 }, (_, index) => {
      const date = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + index,
      );
      return {
        iso: toIsoDate(date),
        date,
        label: WEEKDAY_LABELS[mondayIndex(date)],
      };
    });
  }, [today]);

  const [headingIndex, setHeadingIndex] = useState(RANGE_DAYS);

  // The header names whatever is actually in view rather than a fixed month,
  // because the strip crosses month boundaries as it is dragged.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / STRIDE);
      setHeadingIndex((current) => {
        const next = Math.min(days.length - 1, Math.max(0, index + LEAD_CELLS));
        return next === current ? current : next;
      });
    },
    [days.length],
  );

  const heading = days[headingIndex]?.date ?? today;

  return (
    <View>
      <View style={styles.head}>
        <Text style={{ fontFamily: font.display, fontSize: 14, color: p.text }}>
          {heading.getFullYear()}. {MONTH_NAMES[heading.getMonth()]}
        </Text>
        <Pressable
          onPress={() => {
            listRef.current?.scrollToIndex({
              index: Math.max(0, RANGE_DAYS - LEAD_CELLS),
              animated: true,
            });
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ugrás a mai napra"
          style={({ pressed }) => [
            styles.todayChip,
            { borderColor: p.fieldBorder },
            pressed && { opacity: 0.6 },
          ]}>
          <Text style={[styles.todayLabel, { color: p.muted }]}>Ma</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={days}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(day) => day.iso}
        // A fixed cell width is what lets the strip open on today without
        // measuring, and keeps scrolling cheap over a year of days.
        getItemLayout={(_, index) => ({
          length: STRIDE,
          offset: STRIDE * index,
          index,
        })}
        initialScrollIndex={Math.max(0, RANGE_DAYS - LEAD_CELLS)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={STRIDE}
        renderItem={({ item }) => {
          const active = item.iso === selectedIso;
          const isToday = item.iso === todayIso;

          const inner = (
            <>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: font.bodyMedium,
                  marginBottom: 4,
                  color: active ? 'rgba(255,255,255,0.7)' : p.muted,
                }}>
                {item.label}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: font.display,
                  color: active ? '#fff' : p.text,
                }}>
                {item.date.getDate()}
              </Text>
              {renderMarker ? renderMarker({ day: item, active }) : null}
            </>
          );

          return (
            <Pressable
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.date.getFullYear()}. ${
                MONTH_NAMES[item.date.getMonth()]
              } ${item.date.getDate()}.`}
              style={{ width: CELL_W, marginRight: CELL_GAP }}>
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
                    isToday && { borderWidth: 1, borderColor: violet[400] },
                  ]}>
                  {inner}
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayCell: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  todayChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  todayLabel: {
    fontFamily: font.bodySemi,
    fontSize: 11,
  },
});
