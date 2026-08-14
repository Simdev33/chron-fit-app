import { LinearGradient } from 'expo-linear-gradient';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Pill,
  Plus,
  Trash2,
  User,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddAppointmentSheet } from '@/components/figma/AddAppointmentSheet';
import { AddMedicationSheet } from '@/components/figma/AddMedicationSheet';
import { EmptyState, GlassCard, usePalette } from '@/components/figma/ui';
import { font, fuchsia400, violet } from '@/constants/figma';
import { WEEK } from '@/constants/figmaData';
import { useHealthLog } from '@/context/HealthLogContext';

export default function ScheduleScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { log, removeAppointment, removeMedication } = useHealthLog();
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(13);
  const [addOpen, setAddOpen] = useState(false);
  const [addMedOpen, setAddMedOpen] = useState(false);
  const meds = log.medications;

  const appointments = useMemo(
    () =>
      [...log.appointments].sort((a, b) =>
        `${a.date}T${a.time.padStart(5, '0')}`.localeCompare(
          `${b.date}T${b.time.padStart(5, '0')}`,
        ),
      ),
    [log.appointments],
  );

  const toggle = (id: string) =>
    setTaken((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 140,
        }}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text
            style={{ fontFamily: font.displayX, fontSize: 24, color: p.text }}>
            Szervező
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: font.body,
              color: p.muted,
              marginTop: 2,
            }}>
            Gyógyszerek és időpontok.
          </Text>
        </View>

        {/* Heti naptár */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <GlassCard style={{ padding: 16 }}>
            <View style={styles.calHeader}>
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 14,
                  color: p.text,
                }}>
                2026. augusztus
              </Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable style={[styles.calNav, { backgroundColor: p.chipBg }]}>
                  <ChevronLeft size={14} color={p.muted} />
                </Pressable>
                <Pressable style={[styles.calNav, { backgroundColor: p.chipBg }]}>
                  <ChevronRight size={14} color={p.muted} />
                </Pressable>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {WEEK.map((d) => {
                const active = selectedDate === d.date;
                const inner = (
                  <>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: font.bodyMedium,
                        marginBottom: 4,
                        color: active ? 'rgba(255,255,255,0.7)' : p.muted,
                      }}>
                      {d.day}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: font.display,
                        color: active ? '#fff' : p.text,
                      }}>
                      {d.date}
                    </Text>
                    {'today' in d && d.today && !active ? (
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 999,
                          backgroundColor: violet[500],
                          marginTop: 4,
                        }}
                      />
                    ) : null}
                  </>
                );
                return (
                  <Pressable
                    key={d.date}
                    onPress={() => setSelectedDate(d.date)}
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
        </View>

        {/* Napi gyógyszerek */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: p.muted }]}>
              Napi gyógyszerek
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: font.bodySemi,
                  color: violet[400],
                }}>
                {taken.size}/{meds.length} kész
              </Text>
              <Pressable
                onPress={() => setAddMedOpen(true)}
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
                    Új
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
          {meds.length === 0 && (
            <EmptyState
              emoji="💊"
              title="Még nincs felvett gyógyszer"
              text="Koppints az „Új” gombra, és add hozzá a gyógyszereidet vagy vitaminjaidat — mi számon tartjuk, mikor mi következik."
            />
          )}
          <View style={{ gap: 12 }}>
            {meds.map((m) => {
              const isTaken = taken.has(m.id);
              return (
                <GlassCard
                  key={m.id}
                  style={{ padding: 16, opacity: isTaken ? 0.6 : 1 }}>
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
                        backgroundColor: isTaken
                          ? p.chipBg
                          : 'rgba(139,92,246,0.2)',
                      }}>
                      <Pill
                        size={18}
                        color={
                          isTaken
                            ? p.dark
                              ? 'rgba(255,255,255,0.3)'
                              : '#E9D5FF'
                            : violet[400]
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: font.display,
                          fontSize: 14,
                          color: isTaken
                            ? p.dark
                              ? 'rgba(255,255,255,0.3)'
                              : '#D8B4FE'
                            : p.text,
                          textDecorationLine: isTaken ? 'line-through' : 'none',
                        }}>
                        {m.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: font.body,
                          color: p.muted,
                        }}>
                        {m.dose} · {m.time} · {m.times}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeMedication(m.id)}
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
                    <Pressable
                      onPress={() => toggle(m.id)}
                      style={({ pressed }) => [
                        styles.takeBtn,
                        isTaken
                          ? { backgroundColor: violet[600] }
                          : {
                              backgroundColor: p.chipBg,
                              borderWidth: 1,
                              borderColor: p.dark
                                ? 'rgba(255,255,255,0.15)'
                                : '#E9D5FF',
                            },
                        pressed && { transform: [{ scale: 0.9 }] },
                      ]}>
                      {isTaken ? (
                        <CheckCircle2 size={18} color="#fff" />
                      ) : (
                        <Circle size={18} color={p.muted} />
                      )}
                    </Pressable>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        </View>

        {/* Közelgő időpontok */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: p.muted }]}>
              Közelgő időpontok
            </Text>
            <Pressable
              onPress={() => setAddOpen(true)}
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
                  Új időpont
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
          {appointments.length === 0 ? (
            <EmptyState
              emoji="🗓️"
              title="Nincs közelgő orvosi időpont"
              text="Koppints az „Új” gombra, és rögzítsd a következő vizitedet — időben szólunk majd, és a PDF riportba is bekerül."
            />
          ) : (
            <View style={{ gap: 12 }}>
              {appointments.map((a) => (
                <GlassCard key={a.id} style={{ padding: 16 }}>
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
                        backgroundColor: 'rgba(217,70,239,0.2)',
                      }}>
                      <User size={18} color={fuchsia400} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: font.display,
                          fontSize: 14,
                          color: p.text,
                        }}>
                        {a.doctor}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: font.body,
                          color: p.muted,
                        }}>
                        {a.exam}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: font.display,
                          color: violet[400],
                        }}>
                        {new Date(`${a.date}T12:00:00`).toLocaleDateString(
                          'hu-HU',
                          { month: 'short', day: 'numeric' },
                        )}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: font.body,
                          color: p.muted,
                        }}>
                        {a.time}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeAppointment(a.id)}
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
            </View>
          )}
        </View>
      </ScrollView>

      <AddAppointmentSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
      />
      <AddMedicationSheet
        visible={addMedOpen}
        onClose={() => setAddMedOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNav: {
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
  takeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
