import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
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
import { useHealthLog } from '@/context/HealthLogContext';
import { useProfile } from '@/context/ProfileContext';

const HOURS = [6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 21, 22];
const MINUTES = ['00', '15', '30', '45'];
const FREQUENCIES = [
  '1× naponta',
  '2× naponta',
  '3× naponta',
  'Hetente',
  'Havonta',
];
const WEEKDAYS = [
  'hétfőn',
  'kedden',
  'szerdán',
  'csütörtökön',
  'pénteken',
  'szombaton',
  'vasárnap',
];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function AddMedicationSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const { addMedication } = useHealthLog();
  const { updateProfile } = useProfile();

  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState('00');
  const [frequency, setFrequency] = useState(FREQUENCIES[0]);
  const [weekday, setWeekday] = useState(0);
  const [monthDay, setMonthDay] = useState(1);

  const canSave = name.trim().length > 0 && dose.trim().length > 0;

  const timesLabel =
    frequency === 'Hetente'
      ? `Hetente · ${WEEKDAYS[weekday]}`
      : frequency === 'Havonta'
        ? `Havonta · ${monthDay}-én`
        : frequency;

  const save = () => {
    addMedication({
      name: name.trim(),
      dose: dose.trim(),
      time: `${hour}:${minute}`,
      times: timesLabel,
    });
    updateProfile({ noPrescribedMeds: false });
    setName('');
    setDose('');
    setHour(8);
    setMinute('00');
    setFrequency(FREQUENCIES[0]);
    setWeekday(0);
    setMonthDay(1);
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
    <BottomSheet visible={visible} onClose={onClose} title="Új gyógyszer">
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        <View>
          <Text style={[styles.label, { color: p.muted }]}>
            Gyógyszer / kiegészítő neve
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="pl. Mesalamine"
            placeholderTextColor={p.placeholder}
            style={inputStyle}
          />
        </View>

        <View>
          <Text style={[styles.label, { color: p.muted }]}>Adag</Text>
          <TextInput
            value={dose}
            onChangeText={setDose}
            placeholder="pl. 800mg, 2000 NE"
            placeholderTextColor={p.placeholder}
            style={inputStyle}
          />
        </View>

        <View>
          <Text style={[styles.label, { color: p.muted }]}>
            Milyen gyakran?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FREQUENCIES.map((f) => {
              const active = frequency === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFrequency(f)}
                  style={[
                    styles.freqChip,
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
                      fontFamily: font.bodySemi,
                      color: active ? '#fff' : p.muted,
                    }}>
                    {f}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {frequency === 'Hetente' ? (
          <View>
            <Text style={[styles.label, { color: p.muted }]}>
              Melyik napon?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {WEEKDAYS.map((w, idx) => {
                const active = weekday === idx;
                return (
                  <Pressable
                    key={w}
                    onPress={() => setWeekday(idx)}
                    style={[
                      styles.freqChip,
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
                        fontFamily: font.bodySemi,
                        color: active ? '#fff' : p.muted,
                      }}>
                      {w.charAt(0).toUpperCase() + w.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {frequency === 'Havonta' ? (
          <View>
            <Text style={[styles.label, { color: p.muted }]}>
              A hónap melyik napján?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MONTH_DAYS.map((d) => {
                const active = monthDay === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setMonthDay(d)}
                    style={[
                      styles.dayChip,
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
                        color: active ? '#fff' : p.text,
                      }}>
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View>
          <Text style={[styles.label, { color: p.muted }]}>
            Emlékeztető időpontja
          </Text>
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
            Kiválasztva: {hour}:{minute} · {timesLabel}
          </Text>
        </View>

        {canSave ? (
          <Pressable onPress={save}>
            <LinearGradient
              colors={[violet[600], violet[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtn}>
              <Text style={styles.saveLabel}>Gyógyszer mentése</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View
            style={[
              styles.saveBtn,
              { backgroundColor: p.dark ? 'rgba(255,255,255,0.08)' : '#F3E8FF' },
            ]}>
            <Text style={[styles.saveLabel, { color: p.faint }]}>
              Gyógyszer mentése
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
  freqChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  dayChip: {
    width: 40,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
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
