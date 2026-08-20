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
import { MealSheet, WorkoutSheet } from '@/components/figma/sheets';
import { EmptyState, GlassCard, usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import { RECIPES } from '@/constants/figmaData';
import { useFloraScene } from '@/context/FloraSceneContext';
import { useTabBarSpacing } from '@/context/TabBarContext';
import {
  mealTypeEmoji,
  mealTypeLabels,
  portionLabels,
  toIsoDate,
  useHealthLog,
} from '@/context/HealthLogContext';

const NUTRITION = [
  { label: 'Szénhidrát', cur: 145, goal: 200, color: '#8B5CF6' },
  { label: 'Fehérje', cur: 62, goal: 80, color: '#A78BFA' },
  { label: 'Zsír', cur: 38, goal: 55, color: '#C4B5FD' },
  { label: 'Rost', cur: 12, goal: 20, color: '#7C3AED' },
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
  const todayIso = toIsoDate(new Date());
  const todayMeals = log.meals[todayIso] ?? [];
  const todayKcal = todayMeals.reduce((sum, m) => sum + (m.calories ?? 0), 0);

  return (
    <BackgroundWrapper variant="lifestyle">
      <ScrollView
        showsVerticalScrollIndicator={false}
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
            {/* Mai étkezések */}
            <View>
              <View style={styles.sectionRow}>
                <Text style={[styles.cardLabel, { color: p.muted, marginBottom: 0 }]}>
                  Mai étkezések
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
                      Ma összesen
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

            {/* Napi tápanyagcélok */}
            <GlassCard style={{ padding: 20 }}>
              <Text style={[styles.cardLabel, { color: p.muted }]}>
                Napi tápanyagcélok
              </Text>
              <View style={{ gap: 12 }}>
                {NUTRITION.map((n) => (
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
                        {n.cur}g / {n.goal}g
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
                          width: `${Math.min((n.cur / n.goal) * 100, 100)}%`,
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
          <View style={{ paddingHorizontal: 20, gap: 20 }}>
            {/* Mai ajánlás */}
            <LinearGradient
              colors={['rgba(99,102,241,0.5)', 'rgba(124,58,237,0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(167,139,250,0.2)',
              }}>
              <Text style={styles.recoEyebrow}>Mai ajánlás</Text>
              <Text
                style={{
                  fontFamily: font.displayX,
                  fontSize: 20,
                  color: '#fff',
                  marginBottom: 2,
                }}>
                Könnyű reggeli séta
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: font.body,
                  color: 'rgba(255,255,255,0.6)',
                }}>
                20 perc · Alacsony terhelés · 95 kcal
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <Pressable
                  onPress={() => setWorkoutOpen(true)}
                  style={({ pressed }) => [
                    styles.recoBtn,
                    { backgroundColor: '#fff' },
                    pressed && { transform: [{ scale: 0.95 }] },
                  ]}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: font.display,
                      color: violet[700],
                    }}>
                    Edzés indítása
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setWorkoutOpen(true)}
                  style={({ pressed }) => [
                    styles.recoBtn,
                    {
                      backgroundColor: p.dark
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(168,85,247,0.2)',
                    },
                    pressed && { transform: [{ scale: 0.95 }] },
                  ]}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: font.display,
                      color: p.dark ? 'rgba(255,255,255,0.7)' : '#E9D5FF',
                    }}>
                    Könnyebb opció
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>

            {/* Heti haladás */}
            <GlassCard style={{ padding: 20 }}>
              <Text style={[styles.cardLabel, { color: p.muted }]}>
                Heti haladás
              </Text>
              <View style={{ gap: 12 }}>
                {WEEKLY.map((w) => (
                  <View key={w.label}>
                    <View style={styles.rowBetween}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: font.bodyMedium,
                          color: p.text,
                        }}>
                        {w.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: font.body,
                          color: p.muted,
                        }}>
                        {w.cur.toLocaleString('hu-HU')} /{' '}
                        {w.goal.toLocaleString('hu-HU')} {w.unit}
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
                      <LinearGradient
                        colors={[violet[500], violet[400]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          height: '100%',
                          borderRadius: 999,
                          width: `${Math.min((w.cur / w.goal) * 100, 100)}%`,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </GlassCard>

            {/* Ajánlott edzések */}
            <View style={{ gap: 12 }}>
              {WORKOUTS.map((w) => (
                <GlassCard
                  key={w.name}
                  style={{ padding: 16 }}
                  onPress={() => setWorkoutOpen(true)}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                    <Text style={{ fontSize: 24 }}>{w.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: font.display,
                          fontSize: 14,
                          color: p.text,
                        }}>
                        {w.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: font.body,
                          color: p.muted,
                        }}>
                        {w.dur} · {w.cal} kcal
                      </Text>
                    </View>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: 'rgba(139,92,246,0.2)',
                      }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: font.bodySemi,
                          color: p.dark ? violet[300] : violet[600],
                        }}>
                        {w.tag}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <WorkoutSheet
        visible={workoutOpen}
        onClose={() => setWorkoutOpen(false)}
      />
      <MealSheet visible={mealOpen} onClose={() => setMealOpen(false)} />
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
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
