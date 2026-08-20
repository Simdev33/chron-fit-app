import { LinearGradient } from 'expo-linear-gradient';
import {
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

import { BackgroundWrapper } from '@/components/BackgroundWrapper';
import { AddAppointmentSheet } from '@/components/figma/AddAppointmentSheet';
import { DayStrip } from '@/components/figma/DayStrip';
import { EmptyState, GlassCard, usePalette } from '@/components/figma/ui';
import { MedicationTimeline } from '@/components/organizer/MedicationTimeline';
import { font, fuchsia400, violet } from '@/constants/figma';
import { toIsoDate, useHealthLog } from '@/context/HealthLogContext';
import { useTabBarSpacing } from '@/context/TabBarContext';

const MONTH_SHORT = [
  'jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.',
  'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.',
];

export default function ScheduleScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const tabBarSpacing = useTabBarSpacing();
  const { log, removeAppointment } = useHealthLog();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const appointments = useMemo(
    () =>
      [...log.appointments].sort((a, b) =>
        `${a.date}T${a.time.padStart(5, '0')}`.localeCompare(
          `${b.date}T${b.time.padStart(5, '0')}`,
        ),
      ),
    [log.appointments],
  );

  const todayIso = toIsoDate(new Date());

  /*
   * With a day picked the list is that day's appointments. With none, the
   * section is titled "Közelgő", so past ones are dropped -- until now it
   * listed everything, which is why a blood draw from four days ago still
   * sat under a heading promising what was coming.
   */
  const shownAppointments = useMemo(
    () =>
      selectedDate
        ? appointments.filter((entry) => entry.date === selectedDate)
        : appointments.filter((entry) => entry.date >= todayIso),
    [appointments, selectedDate, todayIso],
  );

  const dayLabel = useMemo(() => {
    if (!selectedDate) return '';
    if (selectedDate === todayIso) return 'Mai nap';
    const [year, month, day] = selectedDate.split('-').map(Number);
    return `${MONTH_SHORT[month - 1]} ${day}.`;
  }, [selectedDate, todayIso]);

  return (
    <BackgroundWrapper variant="organizer">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: tabBarSpacing,
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
            <DayStrip
              selectedIso={selectedDate}
              onSelect={(day) =>
                setSelectedDate((current) =>
                  current === day.iso ? null : day.iso,
                )
              }
            />
          </GlassCard>
        </View>

        {/* Gyógyszer- és étrendkiegészítő idővonal */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: p.muted }]}>
              {selectedDate ? `${dayLabel} gyógyszerei` : 'Mai gyógyszerek és kiegészítők'}
            </Text>
          </View>
          <MedicationTimeline dateIso={selectedDate ?? undefined} />
        </View>

        {/* Közelgő időpontok */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: p.muted }]}>
              {selectedDate ? `${dayLabel} időpontjai` : 'Közelgő időpontok'}
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
          {shownAppointments.length === 0 ? (
            <EmptyState
              emoji="🗓️"
              title={
                selectedDate
                  ? 'Ezen a napon nincs időpont'
                  : 'Nincs közelgő orvosi időpont'
              }
              text={
                selectedDate
                  ? 'Válassz másik napot a sávon, vagy rögzíts ide egy vizitet az „Új időpont” gombbal.'
                  : 'Koppints az „Új” gombra, és rögzítsd a következő vizitedet — időben szólunk majd, és a PDF riportba is bekerül.'
              }
            />
          ) : (
            <View style={{ gap: 12 }}>
              {shownAppointments.map((a) => (
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
                        {a.allDay ? 'Egész nap' : a.time}
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
    </BackgroundWrapper>
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
});
