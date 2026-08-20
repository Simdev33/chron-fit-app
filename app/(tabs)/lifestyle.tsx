import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Search, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackgroundWrapper } from '@/components/BackgroundWrapper';
import { DayStrip } from '@/components/figma/DayStrip';
import { CalorieRing } from '@/components/nutrition/CalorieRing';
import { MealSheet, WorkoutSheet } from '@/components/figma/sheets';
import { FitnessPlanner } from '@/components/fitness/FitnessPlanner';
import { EmptyState, GlassCard, usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import { RECIPES } from '@/constants/figmaData';
import { useFloraScene } from '@/context/FloraSceneContext';
import { useTabBarSpacing } from '@/context/TabBarContext';
import { useProfile } from '@/context/ProfileContext';
import { computeNutritionTargets } from '@/utils/nutritionTargets';
import {
  mealTypeEmoji,
  mealTypeLabels,
  portionLabels,
  toIsoDate,
  useHealthLog,
} from '@/context/HealthLogContext';

/**
 * The bars used to be four fixed numbers. The goals are still reference
 * values, but what is eaten now comes from the meals logged that day.
 */
const NUTRITION = [
  { key: 'carbsG', label: 'Szénhidrát', color: '#8B5CF6' },
  { key: 'proteinG', label: 'Fehérje', color: '#A78BFA' },
  { key: 'fatG', label: 'Zsír', color: '#C4B5FD' },
  { key: 'fiberG', label: 'Rost', color: '#7C3AED' },
] as const;

const MONTH_SHORT = [
  'jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.',
  'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.',
];

const WEEKLY = [
  { label: 'Aktív napok', cur: 4, goal: 5, unit: 'nap' },
  { label: 'Lépés (átlag)', cur: 6200, goal: 8000, unit: 'lépés' },
  { label: 'Edzésperc', cur: 85, goal: 150, unit: 'perc' },
];

const WORKOUTS = [
  {
    name: 'Reggeli séta',
    dur: '20 perc',
    cal: 95,
    tag: 'Alacsony terhelés',
    icon: '🚶',
  },
  { name: 'Jóga flow', dur: '30 perc', cal: 110, tag: 'Kíméletes', icon: '🧘' },
  {
    name: 'Vízi terápia',
    dur: '40 perc',
    cal: 180,
    tag: 'Fellángolás-barát',
    icon: '🏊',
  },
];

export default function LifestyleScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const tabBarSpacing = useTabBarSpacing();
  const [tab, setTab] = useState<'diet' | 'fitness'>('diet');
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [mealOpen, setMealOpen] = useState(false);
  const { setLifestylePane } = useFloraScene();

  useEffect(() => {
    setLifestylePane(tab);
  }, [tab, setLifestylePane]);
  const { log, removeMeal } = useHealthLog();
  const { profile } = useProfile();
  const todayIso = toIsoDate(new Date());
  const [dietDate, setDietDate] = useState(todayIso);

  const todayMeals = log.meals[dietDate] ?? [];
  const todayKcal = todayMeals.reduce((sum, m) => sum + (m.calories ?? 0), 0);

  // Only meals that carry a macro contribute; a blank field is unknown, not
  // zero, and counting it as zero would quietly understate the day.
  // Estimated from the profile, so the bars mean something different for
  // everyone. Null while the profile is missing what the estimate needs.
  const targets = computeNutritionTargets(profile);

  const macroTotals = NUTRITION.map((macro) => ({
    ...macro,
    cur: todayMeals.reduce((sum, meal) => sum + (meal[macro.key] ?? 0), 0),
    goal: targets?.[macro.key] ?? 0,
  }));

  const dietDayLabel =
    dietDate === todayIso
      ? 'Mai étkezések'
      : (() => {
          const [, month, day] = dietDate.split('-').map(Number);
          return `${MONTH_SHORT[month - 1]} ${day}. étkezései`;
        })();

  return (
    <BackgroundWrapper variant="lifestyle">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: tabBarSpacing,
        }}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text
            style={{ fontFamily: font.displayX, fontSize: 24, color: p.text }}>
            Életmód központ
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: font.body,
              color: p.muted,
              marginTop: 2,
            }}>
            Személyre szabott étrend és mozgás az IBD-dhez.
          </Text>
        </View>

        {/* Étrend / Fitnesz váltó */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              padding: 4,
              borderRadius: 16,
              backgroundColor: p.chipBg,
              borderWidth: 1,
              borderColor: p.fieldBorder,
            }}>
            {(
              [
                ['diet', '🥗 Étrend'],
                ['fitness', '💪 Fitnesz'],
              ] as const
            ).map(([id, label]) => {
              const active = tab === id;
              return (
                <Pressable key={id} onPress={() => setTab(id)} style={{ flex: 1 }}>
                  {active ? (
                    <LinearGradient
                      colors={[violet[600], '#9333EA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.segment}>
                      <Text style={[styles.segmentLabel, { color: '#fff' }]}>
                        {label}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.segment}>
                      <Text style={[styles.segmentLabel, { color: p.muted }]}>
                        {label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {tab === 'diet' ? (
          <View style={{ paddingHorizontal: 20, gap: 20 }}>
            {/* Étkezésnapló */}
            <GlassCard style={{ padding: 16 }}>
              <DayStrip
                selectedIso={dietDate}
                onSelect={(day) => setDietDate(day.iso)}
                renderMarker={({ day, active }) => (
                  <View style={styles.mealDots}>
                    {(log.meals[day.iso] ?? []).length ? (
                      <View
                        style={[
                          styles.mealDot,
                          { backgroundColor: active ? '#fff' : violet[400] },
                        ]}
                      />
                    ) : null}
                  </View>
                )}
              />
            </GlassCard>

            <View>
              <View style={styles.sectionRow}>
                <Text style={[styles.cardLabel, { color: p.muted, marginBottom: 0 }]}>
                  {dietDayLabel}
                </Text>
                <Pressable
                  onPress={() => setMealOpen(true)}
                  style={({ pressed }) => [
                    styles.addChip,
                    pressed && { transform: [{ scale: 0.95 }] },
                  ]}>
                  <LinearGradient
                    colors={[violet[600], violet[700]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addChipInner}>
                    <Plus size={14} color="#fff" strokeWidth={2.5} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.display,
                        color: '#fff',
                      }}>
                      Hozzáadás
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
              {todayMeals.length === 0 ? (
                <EmptyState
                  emoji="🍽️"
                  title="Ma még nem rögzítettél étkezést"
                  text="Koppints a „Hozzáadás” gombra, és írd be, mit ettél — a kalóriákat megbecsüljük helyetted. Az étkezésnapló segít felismerni, mely ételek váltanak ki tüneteket."
                />
              ) : (
                <View style={{ gap: 8 }}>
                  {todayMeals.map((m) => (
                    <GlassCard key={m.id} style={{ padding: 14 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                        }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(139,92,246,0.2)',
                          }}>
                          <Text style={{ fontSize: 18 }}>
                            {mealTypeEmoji[m.mealType]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontFamily: font.display,
                              fontSize: 14,
                              color: p.text,
                            }}>
                            {m.name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: font.body,
                              color: p.muted,
                            }}>
                            {mealTypeLabels[m.mealType]} ·{' '}
                            {portionLabels[m.portion]}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: font.display,
                              color: violet[400],
                            }}>
                            {m.calories ?? '–'} kcal
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: font.body,
                              color: p.muted,
                            }}>
                            {m.time}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => removeMeal(todayIso, m.id)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.deleteBtn,
                            {
                              backgroundColor: p.dark
                                ? 'rgba(248,113,113,0.15)'
                                : 'rgba(248,113,113,0.12)',
                            },
                            pressed && { transform: [{ scale: 0.9 }] },
                          ]}>
                          <Trash2 size={14} color="#F87171" />
                        </Pressable>
                      </View>
                    </GlassCard>
                  ))}
                  <View style={styles.kcalTotalRow}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.bodySemi,
                        color: p.muted,
                      }}>
                      {dietDate === todayIso ? 'Ma összesen' : 'Aznap összesen'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: font.displayX,
                        color: violet[400],
                      }}>
                      {todayKcal.toLocaleString('hu-HU')} kcal
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {targets ? (
              <GlassCard style={{ padding: 20, alignItems: 'center' }}>
                <CalorieRing consumed={todayKcal} target={targets.calories} />
                <Text style={[styles.estimateNote, { color: p.faint }]}>
                  Becslés a korod, testsúlyod és magasságod alapján, enyhe
                  aktivitással számolva. Nem fogyókúrás cél.
                </Text>
              </GlassCard>
            ) : (
              <GlassCard style={{ padding: 20 }}>
                <Text style={[styles.cardLabel, { color: p.muted }]}>
                  Napi kalóriakeret
                </Text>
                <Text style={[styles.estimateNote, { color: p.muted, marginTop: 0 }]}>
                  Add meg a korod, testsúlyod és magasságod a profilodban, és
                  kiszámoljuk a napi keretedet meg a tápanyagcéljaidat.
                </Text>
              </GlassCard>
            )}

            {/* Napi bevitt tápanyagok */}
            <GlassCard style={{ padding: 20 }}>
              <Text style={[styles.cardLabel, { color: p.muted }]}>
                Napi bevitt tápanyagok
              </Text>
              <View style={{ gap: 12 }}>
                {macroTotals.map((n) => (
                  <View key={n.label}>
                    <View style={styles.rowBetween}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: font.bodyMedium,
                          color: p.text,
                        }}>
                        {n.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: font.body,
                          color: p.muted,
                        }}>
                        {n.cur}g{n.goal ? ` / ${n.goal}g` : ''}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.progressTrack,
                        {
                          backgroundColor: p.dark
                            ? 'rgba(255,255,255,0.1)'
                            : '#F3E8FF',
                        },
                      ]}>
                      <View
                        style={{
                          height: '100%',
                          borderRadius: 999,
                          width: `${
                            n.goal
                              ? Math.min((n.cur / n.goal) * 100, 100)
                              : 0
                          }%`,
                          backgroundColor: n.color,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </GlassCard>

            {/* Ételkereső */}
            <GlassCard style={{ padding: 16 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: p.chipBg,
                }}>
                <Search size={16} color={p.muted} />
                <Text
                  style={{ fontSize: 14, fontFamily: font.body, color: p.muted }}>
                  Biztonságos ez az étel? Keresés…
                </Text>
              </View>
            </GlassCard>

            {/* Kímélő receptek */}
            <View>
              <Text style={[styles.cardLabel, { color: p.muted }]}>
                Kímélő receptek
              </Text>
              <View style={{ gap: 12 }}>
                {RECIPES.map((r) => (
                  <GlassCard key={r.name} style={{ padding: 16 }} onPress={() => {}}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: font.display,
                            fontSize: 14,
                            color: p.text,
                          }}>
                          {r.name}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginTop: 6,
                          }}>
                          {r.tags.map((t) => (
                            <View
                              key={t}
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 999,
                                backgroundColor: 'rgba(139,92,246,0.2)',
                              }}>
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontFamily: font.bodySemi,
                                  color: p.dark ? violet[300] : violet[600],
                                }}>
                                {t}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: font.display,
                            color: violet[400],
                          }}>
                          {r.cal} kcal
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            fontFamily: font.body,
                            color: p.muted,
                          }}>
                          {r.time}
                        </Text>
                      </View>
                    </View>
                  </GlassCard>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <FitnessPlanner />
        )}
      </ScrollView>

      <WorkoutSheet
        visible={workoutOpen}
        onClose={() => setWorkoutOpen(false)}
      />
      <MealSheet
        visible={mealOpen}
        onClose={() => setMealOpen(false)}
        dateIso={dietDate}
      />
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  estimateNote: {
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 10,
    textAlign: 'center',
  },
  mealDots: {
    height: 5,
    marginTop: 4,
    justifyContent: 'center',
  },
  mealDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  segment: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentLabel: {
    fontFamily: font.display,
    fontSize: 14,
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addChip: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  addChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcalTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  recoEyebrow: {
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  recoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
});
