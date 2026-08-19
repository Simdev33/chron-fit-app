import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Camera,
  CheckCircle2,
  Circle as CircleIcon,
  Clock,
  Minus,
  Pill,
  Plus,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import {
  analyzeMealPhoto,
  pickMealPhoto,
} from '@/utils/analyzeMealPhoto';

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
  medicationDoseKey,
  toIsoDate,
  useHealthLog,
  type FoodImpact,
  type FoodImpactEntry,
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
/* Tegnapi napló                                                       */
/* ------------------------------------------------------------------ */

const BRISTOL = [
  { n: 1, label: 'Kemény' },
  { n: 2, label: 'Csomós' },
  { n: 3, label: 'Repedezett' },
  { n: 4, label: 'Sima' },
  { n: 5, label: 'Puha' },
  { n: 6, label: 'Pépes' },
  { n: 7, label: 'Folyékony' },
];

const ENERGY_LEVELS = ['😫', '😔', '😐', '🙂', '🤩'] as const;

const FOOD_IMPACT_OPTIONS: {
  id: FoodImpact;
  emoji: string;
  label: string;
  color: string;
  backgroundColor: string;
}[] = [
  {
    id: 'good',
    emoji: '🟢',
    label: 'Jól esett',
    color: '#34D399',
    backgroundColor: 'rgba(52,211,153,0.13)',
  },
  {
    id: 'bloated',
    emoji: '🟡',
    label: 'Puffasztott',
    color: '#FACC15',
    backgroundColor: 'rgba(250,204,21,0.13)',
  },
  {
    id: 'painful',
    emoji: '🔴',
    label: 'Fájdalmat okozott',
    color: '#FB7185',
    backgroundColor: 'rgba(251,113,133,0.13)',
  },
];

type MedicationCompliance = 'yes' | 'partial' | 'no';
type MedicationMissReason = 'forgot' | 'left-home' | 'ran-out' | 'unknown';

const MEDICATION_MISS_REASONS: {
  id: MedicationMissReason;
  label: string;
}[] = [
  { id: 'forgot', label: 'Elfelejtettem' },
  { id: 'left-home', label: 'Otthon hagytam' },
  { id: 'ran-out', label: 'Elfogyott' },
  { id: 'unknown', label: 'Nem tudom' },
];

type YesterdayJournal = {
  pain: number;
  bowelMovements: number;
  bristol: number | null;
  blood: boolean;
  energy: number;
  medicationCompliance: MedicationCompliance | null;
  medicationMissReason: MedicationMissReason | null;
  foodImpacts: FoodImpactEntry[];
  note: string;
};

const INITIAL_JOURNAL: YesterdayJournal = {
  pain: 0,
  bowelMovements: 1,
  bristol: null,
  blood: false,
  energy: 3,
  medicationCompliance: null,
  medicationMissReason: null,
  foodImpacts: [],
  note: '',
};

function AnimatedChoice({
  active,
  onPress,
  style,
  containerStyle,
  accessibilityLabel,
  children,
}: {
  active: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(active ? 1.06 : 1, {
      damping: 15,
      stiffness: 240,
      mass: 0.5,
    });
  }, [active, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={containerStyle}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

export function SymptomSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const { log, saveYesterdayJournalForDate } = useHealthLog();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = toIsoDate(yesterday);
  const yesterdayMeals = log.meals[yesterdayIso];
  const mealEntries = yesterdayMeals ?? [];
  const existingJournal = (log.symptoms[yesterdayIso] ?? []).find(
    (entry) =>
      entry.journalKind === 'yesterday' ||
      entry.bowelMovements !== undefined ||
      entry.medicationCompliance !== undefined,
  );
  const [journal, setJournal] = useState<YesterdayJournal>(INITIAL_JOURNAL);

  useEffect(() => {
    if (!visible) return;

    const savedImpacts =
      existingJournal?.foodImpacts ??
      (yesterdayMeals ?? []).flatMap((meal): FoodImpactEntry[] =>
        meal.impact ? [{ mealId: meal.id, impact: meal.impact }] : [],
      );

    setJournal(
      existingJournal
        ? {
            pain: existingJournal.pain,
            bowelMovements: existingJournal.bowelMovements ?? 1,
            bristol: existingJournal.bristol,
            blood: existingJournal.blood,
            energy: existingJournal.energy ?? 3,
            medicationCompliance:
              existingJournal.medicationCompliance ?? null,
            medicationMissReason:
              existingJournal.medicationMissReason ?? null,
            foodImpacts: savedImpacts,
            note: existingJournal.note,
          }
        : { ...INITIAL_JOURNAL, foodImpacts: savedImpacts },
    );
  }, [existingJournal, visible, yesterdayMeals]);

  function updateJournal<K extends keyof YesterdayJournal>(
    key: K,
    value: YesterdayJournal[K],
  ) {
    setJournal((current) => ({ ...current, [key]: value }));
  }

  function setFoodImpact(mealId: string, impact: FoodImpact) {
    setJournal((current) => ({
      ...current,
      foodImpacts: [
        ...current.foodImpacts.filter((item) => item.mealId !== mealId),
        { mealId, impact },
      ],
    }));
  }

  const save = () => {
    saveYesterdayJournalForDate(yesterdayIso, {
      pain: journal.pain,
      bowelMovements: journal.bowelMovements,
      bristol: journal.bristol,
      blood: journal.blood,
      energy: journal.energy,
      medicationCompliance: journal.medicationCompliance,
      medicationMissReason: journal.medicationMissReason,
      foodImpacts: journal.foodImpacts,
      journalKind: 'yesterday',
      note: journal.note.trim(),
    });
    setJournal(INITIAL_JOURNAL);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tegnapi napló">
      <ScrollView
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {existingJournal ? (
          <View
            style={[
              styles.journalCompletedBanner,
              {
                backgroundColor: p.dark
                  ? 'rgba(52,211,153,0.1)'
                  : 'rgba(16,185,129,0.08)',
                borderColor: p.dark
                  ? 'rgba(52,211,153,0.35)'
                  : 'rgba(5,150,105,0.28)',
              },
            ]}>
            <CheckCircle2 size={20} color={emerald400} />
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.journalCompletedTitle, { color: p.text }]}>
                Ezt a naplót már kitöltötted
              </Text>
              <Text
                style={[styles.journalCompletedText, { color: p.muted }]}>
                Az alábbi adatokat bármikor módosíthatod.
              </Text>
            </View>
          </View>
        ) : null}

        <View>
          <View style={styles.rowBetween}>
            <FieldLabel>Tegnapi átlagos hasi fájdalom</FieldLabel>
            <Text
              style={{
                fontFamily: font.displayX,
                fontSize: 24,
                color: violet[400],
              }}>
              {journal.pain}
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
            value={journal.pain}
            onValueChange={(value) => updateJournal('pain', value)}
            minimumTrackTintColor={violet[500]}
            maximumTrackTintColor={p.toggleOff}
            thumbTintColor={violet[500]}
          />
          <View style={styles.rowBetween}>
            <Text style={[styles.sliderTick, { color: p.muted }]}>Nincs · 0</Text>
            <Text style={[styles.sliderTick, { color: p.muted }]}>
              Közepes · 5
            </Text>
            <Text style={[styles.sliderTick, { color: p.muted }]}>
              Súlyos · 10
            </Text>
          </View>
        </View>

        <View>
          <FieldLabel>Székletürítések száma tegnap</FieldLabel>
          <View
            style={[
              styles.counter,
              { backgroundColor: p.fieldBg, borderColor: p.fieldBorder },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Székletürítések számának csökkentése"
              disabled={journal.bowelMovements === 0}
              onPress={() =>
                updateJournal(
                  'bowelMovements',
                  Math.max(0, journal.bowelMovements - 1),
                )
              }
              style={({ pressed }) => [
                styles.counterButton,
                { backgroundColor: p.fieldBgStrong, borderColor: p.fieldBorder },
                journal.bowelMovements === 0 && { opacity: 0.35 },
                pressed && { transform: [{ scale: 0.92 }] },
              ]}>
              <Minus size={22} color={violet[300]} />
            </Pressable>
            <View style={styles.counterValueWrap}>
              <Text style={[styles.counterValue, { color: p.text }]}>
                {journal.bowelMovements}
              </Text>
              <Text style={[styles.counterUnit, { color: p.muted }]}>
                alkalom
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Székletürítések számának növelése"
              onPress={() =>
                updateJournal(
                  'bowelMovements',
                  Math.min(30, journal.bowelMovements + 1),
                )
              }
              style={({ pressed }) => [
                styles.counterButton,
                styles.counterButtonActive,
                pressed && { transform: [{ scale: 0.92 }] },
              ]}>
              <Plus size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View>
          <FieldLabel>Bristol széklet skála</FieldLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bristolRow}>
            {BRISTOL.map((b) => {
              const active = journal.bristol === b.n;
              return (
                <AnimatedChoice
                  key={b.n}
                  active={active}
                  accessibilityLabel={`${b.n}. típus, ${b.label}`}
                  onPress={() => updateJournal('bristol', b.n)}
                  style={[
                    styles.bristolButton,
                    {
                      backgroundColor: active
                        ? violet[600]
                        : p.fieldBgStrong,
                      borderColor: active ? violet[400] : p.fieldBorder,
                    },
                  ]}>
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
                </AnimatedChoice>
              );
            })}
          </ScrollView>
          {journal.bristol ? (
            <Text
              style={{
                fontSize: 12,
                marginTop: 8,
                fontFamily: font.body,
                color: p.muted,
              }}>
              {journal.bristol}. típus: {BRISTOL[journal.bristol - 1].label}
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
          <TogglePill
            value={journal.blood}
            onChange={(value) => updateJournal('blood', value)}
            onColor={red500}
          />
        </View>

        <View>
          <FieldLabel>Tegnapi energiaszint</FieldLabel>
          <View
            accessibilityRole="radiogroup"
            style={styles.energyRow}>
            {ENERGY_LEVELS.map((emoji, index) => {
              const value = index + 1;
              const active = journal.energy === value;
              return (
                <AnimatedChoice
                  key={emoji}
                  active={active}
                  accessibilityLabel={`${value}. energiaszint`}
                  onPress={() => updateJournal('energy', value)}
                  containerStyle={styles.energyChoice}
                  style={[
                    styles.energyButton,
                    {
                      backgroundColor: active
                        ? 'rgba(124,58,237,0.32)'
                        : p.fieldBg,
                      borderColor: active ? violet[400] : p.fieldBorder,
                    },
                    active && styles.energyButtonActive,
                  ]}>
                  <Text style={styles.energyEmoji}>{emoji}</Text>
                </AnimatedChoice>
              );
            })}
          </View>
        </View>

        <View>
          <FieldLabel>Ételek hatása</FieldLabel>
          <Text style={[styles.foodImpactHint, { color: p.muted }]}>
            Flóra már figyeli, mely ételek okozhatnak kellemetlenséget – jelöld
            meg, hogy tegnap melyik hogy esett!
          </Text>

          <View style={styles.foodImpactLegend}>
            {FOOD_IMPACT_OPTIONS.map((option) => (
              <Text
                key={option.id}
                style={[styles.foodImpactLegendText, { color: p.muted }]}>
                {option.emoji} {option.label}
              </Text>
            ))}
          </View>

          {mealEntries.length > 0 ? (
            <View
              accessibilityRole="radiogroup"
              style={styles.foodImpactList}>
              {mealEntries.map((meal) => {
                const selectedImpact = journal.foodImpacts.find(
                  (item) => item.mealId === meal.id,
                )?.impact;

                return (
                  <View
                    key={meal.id}
                    style={[
                      styles.foodImpactCard,
                      {
                        backgroundColor: p.fieldBg,
                        borderColor: p.fieldBorder,
                      },
                    ]}>
                    <View style={styles.foodImpactMeal}>
                      <Text
                        numberOfLines={1}
                        style={[styles.foodImpactMealName, { color: p.text }]}>
                        {meal.name}
                      </Text>
                      <View style={styles.foodImpactTime}>
                        <Clock size={12} color={p.muted} />
                        <Text
                          style={[
                            styles.foodImpactTimeText,
                            { color: p.muted },
                          ]}>
                          {meal.time}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.foodImpactChoices}>
                      {FOOD_IMPACT_OPTIONS.map((option) => {
                        const active = selectedImpact === option.id;
                        return (
                          <AnimatedChoice
                            key={option.id}
                            active={active}
                            accessibilityLabel={`${meal.name}: ${option.label}`}
                            onPress={() => setFoodImpact(meal.id, option.id)}
                            style={[
                              styles.foodImpactButton,
                              {
                                backgroundColor: active
                                  ? option.backgroundColor
                                  : p.fieldBgStrong,
                                borderColor: active
                                  ? option.color
                                  : p.fieldBorder,
                              },
                              active && {
                                shadowColor: option.color,
                                shadowOpacity: 0.35,
                                shadowRadius: 9,
                                shadowOffset: { width: 0, height: 0 },
                                elevation: 5,
                              },
                            ]}>
                            <Text style={styles.foodImpactEmoji}>
                              {option.emoji}
                            </Text>
                          </AnimatedChoice>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View
              style={[
                styles.foodImpactEmpty,
                {
                  backgroundColor: p.fieldBg,
                  borderColor: p.fieldBorder,
                },
              ]}>
              <Text style={styles.foodImpactEmptyEmoji}>🍽️</Text>
              <Text style={[styles.foodImpactEmptyText, { color: p.muted }]}>
                Tegnap nem rögzítettél étkezést.
              </Text>
            </View>
          )}
        </View>

        <View>
          <FieldLabel>Bevetted tegnap az összes gyógyszeredet?</FieldLabel>
          <View
            accessibilityRole="radiogroup"
            style={[
              styles.complianceGroup,
              { backgroundColor: p.fieldBg, borderColor: p.fieldBorder },
            ]}>
            {[
              { id: 'yes', label: 'Igen' },
              { id: 'partial', label: 'Részben' },
              { id: 'no', label: 'Nem' },
            ].map((option) => {
              const id = option.id as MedicationCompliance;
              const active = journal.medicationCompliance === id;
              return (
                <AnimatedChoice
                  key={id}
                  active={active}
                  accessibilityLabel={option.label}
                  onPress={() => {
                    setJournal((current) => ({
                      ...current,
                      medicationCompliance: id,
                      medicationMissReason:
                        id === 'yes' ? null : current.medicationMissReason,
                    }));
                  }}
                  containerStyle={styles.complianceChoice}
                  style={[
                    styles.complianceButton,
                    {
                      backgroundColor: active
                        ? violet[600]
                        : 'transparent',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.complianceLabel,
                      { color: active ? '#fff' : p.muted },
                    ]}>
                    {option.label}
                  </Text>
                </AnimatedChoice>
              );
            })}
          </View>

          {journal.medicationCompliance === 'partial' ||
          journal.medicationCompliance === 'no' ? (
            <View style={styles.missReasonSection}>
              <Text style={[styles.missReasonLabel, { color: p.muted }]}>
                Miért maradt ki?
              </Text>
              <View style={styles.missReasonGroup}>
                {MEDICATION_MISS_REASONS.map((reason) => {
                  const active = journal.medicationMissReason === reason.id;
                  return (
                    <AnimatedChoice
                      key={reason.id}
                      active={active}
                      accessibilityLabel={reason.label}
                      onPress={() =>
                        updateJournal('medicationMissReason', reason.id)
                      }
                      style={[
                        styles.missReasonButton,
                        {
                          backgroundColor: active
                            ? 'rgba(124,58,237,0.24)'
                            : p.fieldBg,
                          borderColor: active
                            ? violet[400]
                            : p.fieldBorder,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.missReasonText,
                          { color: active ? violet[300] : p.muted },
                        ]}>
                        {reason.label}
                      </Text>
                    </AnimatedChoice>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>

        <View>
          <FieldLabel>Megjegyzés (opcionális)</FieldLabel>
          <TextInput
            multiline
            numberOfLines={4}
            value={journal.note}
            onChangeText={(value) => updateJournal('note', value)}
            placeholder="Írj le bármit, ami fontos lehetett tegnap…"
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
          label={
            existingJournal ? 'Módosítások mentése' : 'Naplózás mentése'
          }
          onPress={save}
          disabled={
            (journal.medicationCompliance === 'partial' ||
              journal.medicationCompliance === 'no') &&
            !journal.medicationMissReason
          }
        />
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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
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

  const runPhotoAnalysis = async (source: 'camera' | 'library') => {
    setPhotoError(null);
    try {
      const picked = await pickMealPhoto(source);
      if (!picked) return;

      setPhotoUri(picked.uri);
      setAnalyzing(true);
      const result = await analyzeMealPhoto(picked.base64);

      // The estimate is a starting point, not a verdict: every field stays
      // editable so the user can correct whatever the photo got wrong.
      setName(result.name);
      setPortion(result.portion);
      if (result.calories > 0) setCustomKcal(String(result.calories));
    } catch (error) {
      setPhotoError(
        error instanceof Error
          ? error.message
          : 'Nem sikerült elemezni a képet.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const choosePhotoSource = () => {
    if (analyzing) return;
    // No camera roll prompt on web; the file picker covers both there.
    if (Platform.OS === 'web') {
      void runPhotoAnalysis('library');
      return;
    }
    Alert.alert('Fotó az ételről', 'Honnan válasszunk képet?', [
      { text: 'Kamera', onPress: () => void runPhotoAnalysis('camera') },
      { text: 'Galéria', onPress: () => void runPhotoAnalysis('library') },
      { text: 'Mégse', style: 'cancel' },
    ]);
  };

  const save = () => {
    addMealForToday({ name: name.trim(), portion, mealType, calories });
    setName('');
    setPortion('medium');
    setMealType('lunch');
    setCustomKcal('');
    setPhotoUri(null);
    setPhotoError(null);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Étkezés rögzítése">
      <ScrollView
        contentContainerStyle={styles.sheetBody}
        keyboardShouldPersistTaps="handled">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fotó az ételről"
          onPress={choosePhotoSource}
          disabled={analyzing}
          style={({ pressed }) => [
            {
              paddingVertical: photoUri ? 0 : 40,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              overflow: 'hidden',
              borderWidth: 2,
              borderStyle: photoUri ? 'solid' : 'dashed',
              borderColor: p.dark ? 'rgba(255,255,255,0.15)' : '#E9D5FF',
              opacity: pressed && !analyzing ? 0.75 : 1,
            },
          ]}>
          {photoUri ? (
            <>
              <Image
                source={{ uri: photoUri }}
                style={{ width: '100%', height: 180 }}
                resizeMode="cover"
              />
              {analyzing ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      backgroundColor: 'rgba(12, 4, 26, 0.72)',
                    },
                  ]}>
                  <ActivityIndicator color={violet[400]} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: font.bodyMedium,
                      color: '#FFFFFF',
                    }}>
                    Megnézem, mi van a tányéron…
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              {analyzing ? (
                <ActivityIndicator color={violet[400]} />
              ) : (
                <Camera
                  size={28}
                  color={p.dark ? 'rgba(255,255,255,0.3)' : '#D8B4FE'}
                />
              )}
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: font.bodyMedium,
                  color: p.dark ? 'rgba(255,255,255,0.3)' : '#D8B4FE',
                }}>
                {analyzing ? 'Megnézem, mi van a tányéron…' : 'Fotó az ételről'}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: font.body,
                  color: p.dark ? 'rgba(255,255,255,0.22)' : '#DDD6FE',
                }}>
                Kitöltöm helyetted a nevet és a kalóriát
              </Text>
            </>
          )}
        </Pressable>

        {photoError ? (
          <Text
            style={{
              fontSize: 12,
              fontFamily: font.body,
              color: '#FCA5A5',
              marginTop: -4,
            }}>
            {photoError}
          </Text>
        ) : null}

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
  const { log, setNoMeds, takeMedicationDose } = useHealthLog();
  const { updateProfile } = useProfile();
  const meds = log.medications.filter(
    (medication) =>
      medication.type !== 'biologic' && medication.times.length > 0,
  );
  const taken = new Set(log.takenDoses?.[toIsoDate(new Date())] ?? []);
  const [sideEffect, setSideEffect] = useState(false);
  const [sideEffectText, setSideEffectText] = useState('');
  const [missReason, setMissReason] = useState<string | null>(null);

  const dueNow = meds.filter((m) => m.times.includes('08:00'));
  const dueLater = meds.filter((m) => !m.times.includes('08:00'));
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
                const doseTime = group.later
                  ? (m.times[0] ?? '20:00')
                  : '08:00';
                const isTaken = taken.has(medicationDoseKey(m.id, doseTime));
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => takeMedicationDose(m.id, doseTime)}
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
                        {m.dose} · {m.times.join(', ')}
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
  journalCompletedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  journalCompletedTitle: {
    fontFamily: font.display,
    fontSize: 13,
  },
  journalCompletedText: {
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
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
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  counterButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonActive: {
    borderColor: violet[500],
    backgroundColor: violet[600],
    shadowColor: violet[500],
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  counterValueWrap: {
    alignItems: 'center',
    minWidth: 90,
  },
  counterValue: {
    fontFamily: font.displayX,
    fontSize: 30,
    lineHeight: 34,
  },
  counterUnit: {
    fontFamily: font.body,
    fontSize: 11,
  },
  bristolRow: {
    gap: 8,
    paddingHorizontal: 3,
    paddingVertical: 6,
  },
  bristolButton: {
    width: 64,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },
  energyChoice: {
    flex: 1,
  },
  energyButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyButtonActive: {
    shadowColor: violet[400],
    shadowOpacity: 0.6,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  energyEmoji: {
    fontSize: 25,
    lineHeight: 31,
  },
  foodImpactHint: {
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 10,
  },
  foodImpactLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  foodImpactLegendText: {
    fontFamily: font.bodySemi,
    fontSize: 10,
  },
  foodImpactList: {
    gap: 10,
  },
  foodImpactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  foodImpactMeal: {
    flex: 1,
    minWidth: 0,
  },
  foodImpactMealName: {
    fontFamily: font.display,
    fontSize: 13,
  },
  foodImpactTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  foodImpactTimeText: {
    fontFamily: font.body,
    fontSize: 11,
  },
  foodImpactChoices: {
    flexDirection: 'row',
    gap: 6,
  },
  foodImpactButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodImpactEmoji: {
    fontSize: 20,
    lineHeight: 25,
  },
  foodImpactEmpty: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  foodImpactEmptyEmoji: {
    fontSize: 20,
  },
  foodImpactEmptyText: {
    fontFamily: font.body,
    fontSize: 12,
  },
  complianceGroup: {
    flexDirection: 'row',
    gap: 5,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  complianceChoice: {
    flex: 1,
  },
  complianceButton: {
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  complianceLabel: {
    fontFamily: font.display,
    fontSize: 13,
  },
  missReasonSection: {
    marginTop: 14,
  },
  missReasonLabel: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    marginBottom: 9,
  },
  missReasonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  missReasonButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  missReasonText: {
    fontFamily: font.bodySemi,
    fontSize: 12,
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
    shadowColor: violet[500],
    shadowOpacity: 0.48,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  saveLabel: {
    fontFamily: font.display,
    fontSize: 16,
  },
});
