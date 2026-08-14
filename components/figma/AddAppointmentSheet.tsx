import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet, usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import { toIsoDate, useHealthLog } from '@/context/HealthLogContext';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7..19
const MINUTES = ['00', '15', '30', '45'];

export function AddAppointmentSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const { addAppointment } = useHealthLog();

  const [doctor, setDoctor] = useState('');
  const [exam, setExam] = useState('');
  const [dateIso, setDateIso] = useState(toIsoDate(new Date()));
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState('00');

  // A következő 30 nap választható
  const days = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
          iso: toIsoDate(d),
          day: d.getDate(),
          month: d.toLocaleDateString('hu-HU', { month: 'short' }),
          weekday: d.toLocaleDateString('hu-HU', { weekday: 'short' }),
        };
      }),
    [],
  );

  const canSave = doctor.trim().length > 0 && exam.trim().length > 0;

  const save = () => {
    addAppointment({
      doctor: doctor.trim(),
      exam: exam.trim(),
      date: dateIso,
      time: `${hour}:${minute}`,
    });
    setDoctor('');
    setExam('');
    setDateIso(toIsoDate(new Date()));
    setHour(10);
    setMinute('00');
    onClose();
  };

  const inputStyle = [
    styles.input,
    {
      color: p.text,
      backgroundColor: p.fieldBg,
      borderColor: p.fieldBorder,
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Új időpont">
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        <View>
          <Text style={[styles.label, { color: p.muted }]}>
            Orvos / intézmény
          </Text>
          <TextInput
            value={doctor}
            onChangeText={setDoctor}
            placeholder="pl. Dr. Kovács Anna"
            placeholderTextColor={p.placeholder}
            style={inputStyle}
          />
        </View>

        <View>
          <Text style={[styles.label, { color: p.muted }]}>
            Vizsgálat / szakterület
          </Text>
          <TextInput
            value={exam}
            onChangeText={setExam}
            placeholder="pl. Gasztroenterológia, kolonoszkópia"
            placeholderTextColor={p.placeholder}
            style={inputStyle}
          />
        </View>

        <View>
          <Text style={[styles.label, { color: p.muted }]}>Melyik napon?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, padding: 2 }}>
            {days.map((d) => {
              const active = dateIso === d.iso;
              const inner = (
                <>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: font.bodyMedium,
                      color: active ? 'rgba(255,255,255,0.7)' : p.muted,
                    }}>
                    {d.weekday}
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: font.display,
                      color: active ? '#fff' : p.text,
                    }}>
                    {d.day}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: font.body,
                      color: active ? 'rgba(255,255,255,0.7)' : p.muted,
                    }}>
                    {d.month}
                  </Text>
                </>
              );
              return (
                <Pressable key={d.iso} onPress={() => setDateIso(d.iso)}>
                  {active ? (
                    <LinearGradient
                      colors={[violet[600], violet[700]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.dayChip}>
                      {inner}
                    </LinearGradient>
                  ) : (
                    <View
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: p.fieldBgStrong,
                          borderWidth: 1,
                          borderColor: p.fieldBorder,
                        },
                      ]}>
                      {inner}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View>
          <Text style={[styles.label, { color: p.muted }]}>Hány órakor?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, padding: 2 }}>
            {HOURS.map((h) => {
              const active = hour === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => setHour(h)}
                  style={[
                    styles.timeChip,
                    active
                      ? { backgroundColor: violet[600] }
                      : {
                          backgroundColor: p.fieldBgStrong,
                          borderWidth: 1,
                          borderColor: p.fieldBorder,
                        },
                  ]}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: font.display,
                      color: active ? '#fff' : p.text,
                    }}>
                    {h}:00
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {MINUTES.map((m) => {
              const active = minute === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMinute(m)}
                  style={[
                    styles.minuteChip,
                    active
                      ? { backgroundColor: violet[600] }
                      : {
                          backgroundColor: p.fieldBgStrong,
                          borderWidth: 1,
                          borderColor: p.fieldBorder,
                        },
                  ]}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: font.display,
                      color: active ? '#fff' : p.muted,
                    }}>
                    :{m}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text
            style={{
              fontSize: 12,
              fontFamily: font.bodyMedium,
              color: violet[400],
              marginTop: 10,
            }}>
            Kiválasztva: {hour}:{minute}
          </Text>
        </View>

        {canSave ? (
          <Pressable onPress={save}>
            <LinearGradient
              colors={[violet[600], violet[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtn}>
              <Text style={styles.saveLabel}>Időpont mentése</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View
            style={[
              styles.saveBtn,
              { backgroundColor: p.dark ? 'rgba(255,255,255,0.08)' : '#F3E8FF' },
            ]}>
            <Text style={[styles.saveLabel, { color: p.faint }]}>
              Időpont mentése
            </Text>
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: font.body,
  },
  dayChip: {
    width: 52,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    gap: 1,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  minuteChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveLabel: {
    fontFamily: font.display,
    fontSize: 16,
    color: '#fff',
  },
});
