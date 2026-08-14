import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Camera,
  CheckCircle2,
  Circle as CircleIcon,
  Clock,
  Pill,
  Zap,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  BottomSheet,
  EmptyState,
  TogglePill,
  usePalette,
} from '@/components/figma/ui';
import {
  emerald400,
  font,
  red400,
  red500,
  violet,
} from '@/constants/figma';
import {
  estimateCalories,
  mealTypeLabels,
  toIsoDate,
  useHealthLog,
  type MealType,
} from '@/context/HealthLogContext';
import { useProfile } from '@/context/ProfileContext';

function SaveButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const p = usePalette();
  if (disabled) {
    return (
      <View
        style={[
          styles.saveBtn,
          {
            backgroundColor: p.dark ? 'rgba(255,255,255,0.1)' : '#F3E8FF',
          },
        ]}>
        <Text
          style={[
            styles.saveLabel,
            { color: p.dark ? 'rgba(255,255,255,0.3)' : '#D8B4FE' },
          ]}>
          {label}
        </Text>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { transform: [{ scale: 0.98 }] }}>
      <LinearGradient
        colors={[violet[600], violet[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.saveBtn}>
        <Text style={[styles.saveLabel, { color: '#fff' }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  return (
    <Text
      style={{
        fontFamily: font.display,
        fontSize: 14,
        marginBottom: 10,
        color: p.text,
      }}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Tünetek naplózása                                                   */
/* ------------------------------------------------------------------ */

const BRISTOL = [
  { n: 1, label: 'Kemény rögök' },
  { n: 2, label: 'Csomós' },
  { n: 3, label: 'Repedezett' },
  { n: 4, label: 'Sima' },
  { n: 5, label: 'Puha darabok' },
  { n: 6, label: 'Pépes' },
  { n: 7, label: 'Folyékony' },
];

export function SymptomSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const { addSymptomForToday } = useHealthLog();
  const [pain, setPain] = useState(3);
  const [bristol, setBristol] = useState<number | null>(null);
  const [blood, setBlood] = useState(false);
  const [note, setNote] = useState('');

  const save = () => {
    addSymptomForToday({ pain, bristol, blood, note: note.trim() });
    setPain(3);
    setBristol(null);
    setBlood(false);
    setNote('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tünetek naplózása">
      <ScrollView
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled">
        <View>
          <View style={styles.rowBetween}>
            <FieldLabel>Fájdalomszint</FieldLabel>
            <Text
              style={{
                fontFamily: font.displayX,
                fontSize: 24,
                color: violet[400],
              }}>
              {pain}
              <Text
                style={{
                  fontFamily: font.body,
                  fontSize: 14,
                  color: p.muted,
                }}>
                /10
              </Text>
            </Text>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={10}
            step={1}
            value={pain}
            onValueChange={setPain}
            minimumTrackTintColor={violet[500]}
            maximumTrackTintColor={p.toggleOff}
            thumbTintColor={violet[500]}
          />
          <View style={styles.rowBetween}>
            <Text style={[styles.sliderTick, { color: p.muted }]}>Nincs</Text>
            <Text style={[styles.sliderTick, { color: p.muted }]}>
              Közepes
            </Text>
            <Text style={[styles.sliderTick, { color: p.muted }]}>Súlyos</Text>
          </View>
        </View>

        <View>
          <FieldLabel>Bristol széklet skála</FieldLabel>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {BRISTOL.map((b) => {
              const active = bristol === b.n;
              return (
                <Pressable
                  key={b.n}
                  onPress={() => setBristol(b.n)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 2,
                    borderRadius: 12,
                    backgroundColor: active
                      ? violet[600]
                      : p.fieldBgStrong,
                    borderWidth: active ? 0 : 1,
                    borderColor: p.fieldBorder,
                  }}>
                  <Text
                    style={{
                      fontFamily: font.display,
                      fontSize: 14,
                      color: active ? '#fff' : p.muted,
                    }}>
                    {b.n}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 8,
                      marginTop: 2,
                      fontFamily: font.body,
                      color: active ? '#fff' : p.muted,
                    }}>
                    {b.label.split(' ')[0]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {bristol ? (
            <Text
              style={{
                fontSize: 12,
                marginTop: 8,
                fontFamily: font.body,
                color: p.muted,
              }}>
              {bristol}. típus: {BRISTOL[bristol - 1].label}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.toggleRow,
            { backgroundColor: p.fieldBg, borderColor: p.fieldBorder },
          ]}>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: font.display, fontSize: 14, color: p.text }}>
              Vér jelenléte
            </Text>
            <Text
              style={{ fontSize: 12, fontFamily: font.body, color: p.muted }}>
              Végbélvérzés vagy vér a székletben
            </Text>
          </View>
          <TogglePill value={blood} onChange={setBlood} onColor={red500} />
        </View>

        <View>
          <FieldLabel>Megjegyzés (opcionális)</FieldLabel>
          <TextInput
            multiline
            numberOfLines={3}
            value={note}
            onChangeText={setNote}
            placeholder="További megjegyzések…"
            placeholderTextColor={p.placeholder}
            style={[
              styles.textarea,
              {
                color: p.text,
                backgroundColor: p.fieldBg,
                borderColor: p.fieldBorder,
              },
            ]}
          />
        </View>

        <SaveButton label="Napló mentése" onPress={save} />
      </ScrollView>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Étkezés rögzítése                                                   */
/* ------------------------------------------------------------------ */

export function MealSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const { addMealForToday } = useHealthLog();
  const [name, setName] = useState('');
  const [portion, setPortion] = useState<'small' | 'medium' | 'large'>(
    'medium',
  );
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [customKcal, setCustomKcal] = useState('');
  const portions = [
    { id: 'small', label: 'Kicsi' },
    { id: 'medium', label: 'Közepes' },
    { id: 'large', label: 'Nagy' },
  ] as const;
  const mealTypes = [
    'breakfast',
    'lunch',
    'dinner',
    'snack',
  ] as const;

  const estimated = estimateCalories(name, portion, mealType);
  const customValue = parseInt(customKcal, 10);
  const hasCustom = !Number.isNaN(customValue) && customValue > 0;
  const calories = hasCustom ? customValue : estimated;

  const save = () => {
    addMealForToday({ name: name.trim(), portion, mealType, calories });
    setName('');
    setPortion('medium');
    setMealType('lunch');
    setCustomKcal('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Étkezés rögzítése">
      <ScrollView
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled">
        <Pressable
          style={{
            paddingVertical: 40,
            borderRadius: 16,
            alignItems: 'center',
            gap: 8,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: p.dark ? 'rgba(255,255,255,0.15)' : '#E9D5FF',
          }}>
          <Camera
            size={28}
            color={p.dark ? 'rgba(255,255,255,0.3)' : '#D8B4FE'}
          />
          <Text
            style={{
              fontSize: 14,
              fontFamily: font.bodyMedium,
              color: p.dark ? 'rgba(255,255,255,0.3)' : '#D8B4FE',
            }}>
            Fotó az ételről
          </Text>
        </Pressable>

        <View>
          <FieldLabel>Étel neve</FieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="pl. Sült lazac rizzsel"
            placeholderTextColor={p.placeholder}
            style={[
              styles.input,
              {
                color: p.text,
                backgroundColor: p.fieldBg,
                borderColor: p.fieldBorder,
              },
            ]}
          />
        </View>

        <View>
          <FieldLabel>Adag mérete</FieldLabel>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              padding: 4,
              borderRadius: 16,
              backgroundColor: p.fieldBg,
              borderWidth: 1,
              borderColor: p.fieldBorder,
            }}>
            {portions.map((o) => {
              const active = portion === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setPortion(o.id)}
                  style={{ flex: 1 }}>
                  {active ? (
                    <LinearGradient
                      colors={[violet[600], violet[700]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.segment}>
                      <Text style={[styles.segmentLabel, { color: '#fff' }]}>
                        {o.label}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.segment}>
                      <Text style={[styles.segmentLabel, { color: p.muted }]}>
                        {o.label}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <FieldLabel>Étkezés típusa</FieldLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {mealTypes.map((t) => {
              const active = mealType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setMealType(t)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: active ? violet[600] : p.fieldBgStrong,
                    borderWidth: active ? 0 : 1,
                    borderColor: p.fieldBorder,
                  }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.bodySemi,
                      color: active ? '#fff' : p.muted,
                    }}>
                    {mealTypeLabels[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <FieldLabel>Kalória</FieldLabel>
          <View
            style={[
              styles.kcalRow,
              { backgroundColor: p.fieldBg, borderColor: p.fieldBorder },
            ]}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: font.body,
                  color: p.muted,
                }}>
                {hasCustom ? 'Egyéni érték' : 'Automatikus becslés'}
              </Text>
              <Text
                style={{
                  fontFamily: font.displayX,
                  fontSize: 22,
                  color: violet[400],
                }}>
                {calories}
                <Text
                  style={{
                    fontFamily: font.body,
                    fontSize: 13,
                    color: p.muted,
                  }}>
                  {' '}
                  kcal
                </Text>
              </Text>
            </View>
            <TextInput
              value={customKcal}
              onChangeText={setCustomKcal}
              keyboardType="number-pad"
              maxLength={4}
              placeholder={`${estimated}`}
              placeholderTextColor={p.placeholder}
              style={[
                styles.kcalInput,
                {
                  color: p.text,
                  backgroundColor: p.fieldBgStrong,
                  borderColor: hasCustom ? violet[500] : p.fieldBorder,
                },
              ]}
            />
          </View>
          <Text
            style={{
              fontSize: 11,
              fontFamily: font.body,
              color: p.faint,
              marginTop: 6,
            }}>
            A becslés az étel neve és az adag mérete alapján készül. Ha
            pontosan tudod az értéket, írd be a mezőbe.
          </Text>
        </View>

        <SaveButton
          label="Étkezés mentése"
          onPress={save}
          disabled={!name.trim()}
        />
      </ScrollView>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Edzés naplózása                                                     */
/* ------------------------------------------------------------------ */

const ACTIVITIES = [
  { id: 'walk', label: 'Séta', icon: '🚶', tag: 'Alacsony terhelés' },
  { id: 'yoga', label: 'Jóga', icon: '🧘', tag: 'Kíméletes' },
  { id: 'swim', label: 'Úszás', icon: '🏊', tag: 'Fellángolás-barát' },
  { id: 'bike', label: 'Kerékpár', icon: '🚴', tag: 'Mérsékelt' },
  { id: 'stretch', label: 'Nyújtás', icon: '🤸', tag: 'Kíméletes' },
  { id: 'strength', label: 'Erősítés', icon: '💪', tag: 'Mérsékelt' },
];

const INTENSITIES = [
  {
    id: 'low',
    label: 'Alacsony',
    desc: 'Könnyű terhelés, nyugodt légzés',
    color: emerald400,
  },
  {
    id: 'moderate',
    label: 'Mérsékelt',
    desc: 'Enyhén szapora légzés',
    color: violet[400],
  },
  {
    id: 'high',
    label: 'Magas',
    desc: 'Fellángolás alatt nem ajánlott',
    color: red400,
  },
] as const;

export function WorkoutSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const [activity, setActivity] = useState<string | null>(null);
  const [duration, setDuration] = useState(20);
  const [intensity, setIntensity] = useState<'low' | 'moderate' | 'high'>(
    'low',
  );
  const [note, setNote] = useState('');
  const kcal = Math.round(
    duration * (intensity === 'low' ? 4.2 : intensity === 'moderate' ? 6.5 : 9),
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Edzés naplózása">
      <ScrollView
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled">
        <View>
          <FieldLabel>Mozgásforma</FieldLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ACTIVITIES.map((a) => {
              const active = activity === a.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setActivity(a.id)}
                  style={{
                    width: '31%',
                    flexGrow: 1,
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: active ? violet[500] : p.fieldBorder,
                    backgroundColor: active
                      ? 'rgba(139,92,246,0.2)'
                      : p.fieldBg,
                  }}>
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>
                    {a.icon}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.display,
                      color: active ? violet[300] : p.text,
                    }}>
                    {a.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 9,
                      marginTop: 2,
                      fontFamily: font.body,
                      color: active ? violet[400] : p.muted,
                    }}>
                    {a.tag}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <View style={styles.rowBetween}>
            <FieldLabel>Időtartam</FieldLabel>
            <Text
              style={{
                fontFamily: font.displayX,
                fontSize: 24,
                color: violet[400],
              }}>
              {duration}
              <Text
                style={{ fontFamily: font.body, fontSize: 14, color: p.muted }}>
                {' '}
                perc
              </Text>
            </Text>
          </View>
          <Slider
            minimumValue={5}
            maximumValue={90}
            step={5}
            value={duration}
            onValueChange={setDuration}
            minimumTrackTintColor={violet[500]}
            maximumTrackTintColor={p.toggleOff}
            thumbTintColor={violet[500]}
          />
          <View style={styles.rowBetween}>
            <Text style={[styles.sliderTick, { color: p.muted }]}>5 perc</Text>
            <Text style={[styles.sliderTick, { color: p.muted }]}>
              45 perc
            </Text>
            <Text style={[styles.sliderTick, { color: p.muted }]}>
              90 perc
            </Text>
          </View>
        </View>

        <View>
          <FieldLabel>Intenzitás</FieldLabel>
          <View style={{ gap: 8 }}>
            {INTENSITIES.map((i) => {
              const active = intensity === i.id;
              return (
                <Pressable
                  key={i.id}
                  onPress={() => setIntensity(i.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: active ? violet[500] : p.fieldBorder,
                    backgroundColor: active
                      ? 'rgba(139,92,246,0.15)'
                      : p.fieldBg,
                  }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: i.color,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: font.bodySemi,
                        color: active ? i.color : p.text,
                      }}>
                      {i.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: font.body,
                        color: p.muted,
                      }}>
                      {i.desc}
                    </Text>
                  </View>
                  {active ? (
                    <CheckCircle2 size={16} color={violet[400]} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.toggleRow,
            { backgroundColor: p.fieldBg, borderColor: p.fieldBorder },
          ]}>
          <View>
            <Text
              style={{ fontSize: 12, fontFamily: font.body, color: p.muted }}>
              Becsült égetés
            </Text>
            <Text
              style={{
                fontFamily: font.displayX,
                fontSize: 18,
                color: violet[400],
              }}>
              ~{kcal}{' '}
              <Text
                style={{ fontFamily: font.body, fontSize: 14, color: p.muted }}>
                kcal
              </Text>
            </Text>
          </View>
          <Zap size={24} color="rgba(167,139,250,0.6)" />
        </View>

        <View>
          <FieldLabel>Megjegyzés (opcionális)</FieldLabel>
          <TextInput
            multiline
            numberOfLines={2}
            value={note}
            onChangeText={setNote}
            placeholder="Milyen érzés volt? Volt fájdalom?"
            placeholderTextColor={p.placeholder}
            style={[
              styles.textarea,
              {
                color: p.text,
                backgroundColor: p.fieldBg,
                borderColor: p.fieldBorder,
              },
            ]}
          />
        </View>

        <SaveButton
          label="Edzés mentése"
          onPress={onClose}
          disabled={!activity}
        />
      </ScrollView>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Gyógyszer bevétele                                                  */
/* ------------------------------------------------------------------ */

const MISS_REASONS = [
  'Elfelejtettem',
  'Mellékhatás',
  'Elfogyott',
  'Jobban voltam',
  'Egyéb',
];

export function MedicationSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const { log, setNoMeds, toggleMedicationTaken } = useHealthLog();
  const { updateProfile } = useProfile();
  const meds = log.medications;
  const taken = new Set(log.takenDoses?.[toIsoDate(new Date())] ?? []);
  const [sideEffect, setSideEffect] = useState(false);
  const [sideEffectText, setSideEffectText] = useState('');
  const [missReason, setMissReason] = useState<string | null>(null);

  const toggle = (id: string) => toggleMedicationTaken(id);

  const dueNow = meds.filter((m) => m.time === '8:00');
  const dueLater = meds.filter((m) => m.time !== '8:00');
  const progress =
    meds.length > 0 ? (taken.size / meds.length) * 138 : 0;

  if (meds.length === 0) {
    return (
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title="Gyógyszer bevétele">
        <View style={[styles.sheetBody, { paddingBottom: 24 }]}>
          {log.noMeds ? (
            <EmptyState
              emoji="🙌"
              title="Nem szedsz gyógyszert"
              text="Ezt jelezted nekünk, így itt nincs teendőd. Ha ez változik, a Szervező fülön bármikor felvehetsz új gyógyszert."
            />
          ) : (
            <>
              <EmptyState
                emoji="💊"
                title="Még nincs felvett gyógyszer"
                text="A gyógyszereidet a profilodban vagy a Szervező fülön tudod felvenni — utána itt pipálhatod ki a napi adagokat."
              />
              <Pressable
                onPress={() => {
                  setNoMeds(true);
                  updateProfile({ noPrescribedMeds: true, prescribedMeds: [] });
                }}
                style={({ pressed }) => [
                  { alignSelf: 'center', padding: 6 },
                  pressed && { opacity: 0.6 },
                ]}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: font.bodySemi,
                    color: violet[400],
                    textDecorationLine: 'underline',
                  }}>
                  Nem szedek gyógyszert
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Gyógyszer bevétele">
      <ScrollView
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.toggleRow,
            {
              backgroundColor: p.fieldBg,
              borderColor: p.fieldBorder,
              gap: 16,
              justifyContent: 'flex-start',
            },
          ]}>
          <View style={{ width: 56, height: 56 }}>
            <Svg
              width={56}
              height={56}
              viewBox="0 0 56 56"
              style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle
                cx={28}
                cy={28}
                r={22}
                fill="none"
                stroke={
                  p.dark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.1)'
                }
                strokeWidth={4}
              />
              <Circle
                cx={28}
                cy={28}
                r={22}
                fill="none"
                stroke={violet[500]}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={`${progress} 138`}
              />
            </Svg>
            <View
              style={[
                StyleSheet.absoluteFill,
                { alignItems: 'center', justifyContent: 'center' },
              ]}>
              <Text
                style={{
                  fontFamily: font.displayX,
                  fontSize: 12,
                  color: violet[400],
                }}>
                {taken.size}/{meds.length}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: font.display, fontSize: 16, color: p.text }}>
              {taken.size === 0
                ? 'Kezdjük!'
                : taken.size === meds.length
                  ? 'Minden kész! 🎉'
                  : `${meds.length - taken.size} van hátra`}
            </Text>
            <Text
              style={{ fontSize: 12, fontFamily: font.body, color: p.muted }}>
              Koppints a gyógyszerre, ha bevetted
            </Text>
          </View>
        </View>

        {[
          { label: 'Esedékes most · 8:00', list: dueNow, later: false },
          { label: 'Később esedékes · 21:00', list: dueLater, later: true },
        ].map((group) => (
          <View key={group.label}>
            <Text style={[styles.groupLabel, { color: p.muted }]}>
              {group.label}
            </Text>
            <View style={{ gap: 8 }}>
              {group.list.map((m) => {
                const isTaken = taken.has(m.id);
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => toggle(m.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderRadius: 16,
                      borderWidth: 2,
                      opacity: group.later && !isTaken ? 0.6 : 1,
                      borderColor: isTaken ? violet[500] : p.fieldBorder,
                      backgroundColor: isTaken
                        ? 'rgba(139,92,246,0.15)'
                        : p.fieldBg,
                    }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isTaken
                          ? p.chipBg
                          : group.later
                            ? p.chipBg
                            : 'rgba(139,92,246,0.2)',
                      }}>
                      {group.later && !isTaken ? (
                        <Clock
                          size={18}
                          color={
                            p.dark ? 'rgba(255,255,255,0.3)' : '#D8B4FE'
                          }
                        />
                      ) : (
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
                      )}
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
                          textDecorationLine: isTaken
                            ? 'line-through'
                            : 'none',
                        }}>
                        {m.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: font.body,
                          color: p.muted,
                        }}>
                        {m.dose} · {group.later ? m.time : m.times}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isTaken
                          ? violet[600]
                          : p.chipBg,
                        borderWidth: isTaken ? 0 : 1,
                        borderColor: p.dark
                          ? 'rgba(255,255,255,0.15)'
                          : '#E9D5FF',
                      }}>
                      {isTaken ? (
                        <CheckCircle2 size={16} color="#fff" />
                      ) : (
                        <CircleIcon size={16} color={p.muted} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View
          style={[
            styles.toggleRow,
            { backgroundColor: p.fieldBg, borderColor: p.fieldBorder },
          ]}>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: font.display, fontSize: 14, color: p.text }}>
              Mellékhatást észleltél?
            </Text>
            <Text
              style={{ fontSize: 12, fontFamily: font.body, color: p.muted }}>
              Jelezzük az orvosodnak
            </Text>
          </View>
          <TogglePill value={sideEffect} onChange={setSideEffect} />
        </View>

        {sideEffect ? (
          <View>
            <FieldLabel>Írd le a mellékhatást</FieldLabel>
            <TextInput
              multiline
              numberOfLines={2}
              value={sideEffectText}
              onChangeText={setSideEffectText}
              placeholder="pl. Hányinger az Azathioprine után…"
              placeholderTextColor={p.placeholder}
              style={[
                styles.textarea,
                {
                  color: p.text,
                  backgroundColor: p.fieldBg,
                  borderColor: p.fieldBorder,
                },
              ]}
            />
          </View>
        ) : null}

        {taken.size < meds.length ? (
          <View>
            <Text style={[styles.groupLabel, { color: p.muted }]}>
              Kihagytál egy dózist? Mondd el, miért
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MISS_REASONS.map((r) => {
                const active = missReason === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setMissReason(active ? null : r)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active
                        ? violet[500]
                        : p.dark
                          ? 'rgba(255,255,255,0.15)'
                          : '#E9D5FF',
                      backgroundColor: active ? violet[600] : p.fieldBg,
                    }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.bodyMedium,
                        color: active ? '#fff' : p.muted,
                      }}>
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <SaveButton label="Gyógyszernapló mentése" onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 24,
  },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  kcalInput: {
    width: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: font.display,
    textAlign: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderTick: {
    fontSize: 10,
    fontFamily: font.body,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  textarea: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: font.body,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: font.body,
    borderWidth: 1,
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
  groupLabel: {
    fontSize: 12,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveLabel: {
    fontFamily: font.display,
    fontSize: 16,
  },
});
