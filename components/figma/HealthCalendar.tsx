import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Droplets } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard, usePalette } from '@/components/figma/ui';
import { font, fuchsia400, red400, violet } from '@/constants/figma';
import {
  MOOD_EMOJI,
  MOOD_LABELS,
  toIsoDate,
  useHealthLog,
} from '@/context/HealthLogContext';

const WEEKDAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

export function HealthCalendar() {
  const p = usePalette();
  const { log } = useHealthLog();

  const todayIso = toIsoDate(new Date());
  const [selected, setSelected] = useState(todayIso);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return { iso: toIsoDate(d), date: d.getDate() };
      }),
    [weekStart],
  );

  // A hét közepe (csütörtök) alapján címkézzük a hónapot
  const monthLabel = useMemo(() => {
    const mid = new Date(weekStart);
    mid.setDate(mid.getDate() + 3);
    return mid.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });
  }, [weekStart]);

  const shiftWeek = (delta: number) =>
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });

  const selectedMood = log.moods[selected];
  const selectedSymptoms = log.symptoms[selected] ?? [];
  const selectedLabel = new Date(`${selected}T12:00:00`).toLocaleDateString(
    'hu-HU',
    { month: 'long', day: 'numeric', weekday: 'long' },
  );

  return (
    <View style={{ gap: 12 }}>
      <GlassCard style={{ padding: 16 }}>
        <View style={styles.header}>
          <Text style={{ fontFamily: font.display, fontSize: 14, color: p.text }}>
            {monthLabel}
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable
              onPress={() => shiftWeek(-1)}
              style={[styles.nav, { backgroundColor: p.chipBg }]}>
              <ChevronLeft size={14} color={p.muted} />
            </Pressable>
            <Pressable
              onPress={() => shiftWeek(1)}
              style={[styles.nav, { backgroundColor: p.chipBg }]}>
              <ChevronRight size={14} color={p.muted} />
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 4 }}>
          {days.map((d, i) => {
            const active = selected === d.iso;
            const isToday = d.iso === todayIso;
            const moodIdx = log.moods[d.iso];
            const hasSymptoms = (log.symptoms[d.iso] ?? []).length > 0;
            const inner = (
              <>
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: font.bodyMedium,
                    marginBottom: 4,
                    color: active ? 'rgba(255,255,255,0.7)' : p.muted,
                  }}>
                  {WEEKDAYS[i]}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: font.display,
                    color: active ? '#fff' : isToday ? violet[400] : p.text,
                  }}>
                  {d.date}
                </Text>
                {moodIdx ? (
                  <Text style={{ fontSize: 10, marginTop: 2 }}>
                    {MOOD_EMOJI[moodIdx - 1]}
                  </Text>
                ) : (
                  <View style={{ height: 15 }} />
                )}
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    marginTop: 2,
                    backgroundColor: hasSymptoms
                      ? active
                        ? '#fff'
                        : fuchsia400
                      : 'transparent',
                  }}
                />
              </>
            );
            return (
              <Pressable
                key={d.iso}
                onPress={() => setSelected(d.iso)}
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
                  <View style={styles.dayCell}>{inner}</View>
                )}
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      {/* Kiválasztott nap részletei */}
      <GlassCard style={{ padding: 16 }}>
        <Text
          style={{
            fontFamily: font.display,
            fontSize: 14,
            color: p.text,
            marginBottom: 12,
          }}>
          {selectedLabel}
        </Text>

        <View style={styles.moodRow}>
          <Text style={{ fontSize: 22 }}>
            {selectedMood ? MOOD_EMOJI[selectedMood - 1] : '➖'}
          </Text>
          <View>
            <Text
              style={{ fontSize: 10, fontFamily: font.bodySemi, color: p.muted }}>
              HANGULAT
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: font.bodyMedium,
                color: selectedMood ? p.text : p.faint,
              }}>
              {selectedMood
                ? MOOD_LABELS[selectedMood - 1]
                : 'Nincs rögzítve'}
            </Text>
          </View>
        </View>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: p.divider,
            marginTop: 12,
            paddingTop: 12,
            gap: 10,
          }}>
          <Text
            style={{ fontSize: 10, fontFamily: font.bodySemi, color: p.muted }}>
            TÜNETEK
          </Text>
          {selectedSymptoms.length === 0 ? (
            <Text
              style={{ fontSize: 13, fontFamily: font.body, color: p.faint }}>
              Ezen a napon nem rögzítettél tünetet — remélhetőleg jó nap volt.
              ✨
            </Text>
          ) : (
            selectedSymptoms.map((s) => (
              <View
                key={s.id}
                style={[
                  styles.symptomRow,
                  { backgroundColor: p.fieldBg, borderColor: p.fieldBorder },
                ]}>
                <View style={styles.symptomHead}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.display,
                      color: violet[400],
                    }}>
                    {s.time}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.bodySemi,
                      color: p.text,
                    }}>
                    Fájdalom: {s.pain}/10
                  </Text>
                  {s.bristol ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.body,
                        color: p.muted,
                      }}>
                      Bristol {s.bristol}. típus
                    </Text>
                  ) : null}
                  {s.blood ? (
                    <View style={styles.bloodBadge}>
                      <Droplets size={10} color={red400} />
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: font.bodySemi,
                          color: red400,
                        }}>
                        Vér
                      </Text>
                    </View>
                  ) : null}
                </View>
                {s.note ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.body,
                      color: p.muted,
                      marginTop: 4,
                    }}>
                    {s.note}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  nav: {
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
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  symptomRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  symptomHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  bloodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(248,113,113,0.15)',
  },
});
