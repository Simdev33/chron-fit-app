import { BlurView } from 'expo-blur';
import { Minus, Plus, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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

import { font, violet } from '@/constants/figma';

export type NewMedicationInput = {
  name: string;
  dose: string;
  type: 'pill' | 'supplement' | 'biologic';
  times: string[];
  inventoryRemaining: number;
  refillThreshold: number;
  since: string;
  administrationLocation?: 'home' | 'hospital';
  intervalMonths?: 1 | 2 | 3;
  lastDoseDate?: string;
  nextDoseDate?: string;
};

type FormState = {
  name: string;
  dose: string;
  type: NewMedicationInput['type'];
  times: string[];
  inventory: string;
  refillThreshold: number;
  since: string;
  administrationLocation: 'home' | 'hospital';
  intervalMonths: 1 | 2 | 3;
  lastDoseDate: string;
};

function createInitialForm(): FormState {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return {
    name: '',
    dose: '',
    type: 'pill',
    times: ['08:00'],
    inventory: '30',
    refillThreshold: 5,
    since: `${year}-${month}-${day}`,
    administrationLocation: 'home',
    intervalMonths: 1,
    lastDoseDate: `${year}-${month}-${day}`,
  };
}

function calculateNextDoseDate(lastDoseDate: string, months: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastDoseDate)) return '';
  const [year, month, day] = lastDoseDate.split('-').map(Number);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(year, month, 0).getDate()
  ) {
    return '';
  }
  const targetMonth = month - 1 + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const finalDay = Math.min(
    day,
    new Date(targetYear, normalizedMonth + 1, 0).getDate(),
  );
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(
    finalDay,
  ).padStart(2, '0')}`;
}

const TIME_OPTIONS = [
  { label: 'Reggel', time: '08:00' },
  { label: 'Délben', time: '13:00' },
  { label: 'Este', time: '20:00' },
];

function AnimatedOption({
  selected,
  onPress,
  style,
  containerStyle,
  children,
  accessibilityLabel,
}: {
  selected: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  containerStyle?: ViewStyle;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.035 : 1, {
      damping: 15,
      stiffness: 230,
      mass: 0.5,
    });
  }, [scale, selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={containerStyle}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

function FloatingInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.floatingField}>
      <Text style={styles.floatingLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(216,180,254,0.3)"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

export function AddMedicationModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: NewMedicationInput) => void;
}) {
  const [form, setForm] = useState<FormState>(createInitialForm);

  const update = <K extends keyof FormState,>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const inventory = Number.parseInt(form.inventory, 10);
  const isBiologic = form.type === 'biologic';
  const nextDoseDate = calculateNextDoseDate(
    form.lastDoseDate,
    form.intervalMonths,
  );
  const canSave =
    form.name.trim().length > 0 &&
    form.dose.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(form.since) &&
    (isBiologic
      ? nextDoseDate.length > 0
      : form.times.length > 0 &&
        Number.isFinite(inventory) &&
        inventory > 0);

  const toggleTime = (time: string) => {
    update(
      'times',
      form.times.includes(time)
        ? form.times.filter((value) => value !== time)
        : [...form.times, time].sort(),
    );
  };

  const save = () => {
    if (!canSave) return;
    const result: NewMedicationInput = {
      name: form.name.trim(),
      dose: form.dose.trim(),
      type: form.type,
      times: isBiologic ? [] : [...form.times].sort(),
      inventoryRemaining: isBiologic ? 0 : inventory,
      refillThreshold: isBiologic ? 0 : form.refillThreshold,
      since: form.since,
      ...(isBiologic
        ? {
            administrationLocation: form.administrationLocation,
            intervalMonths: form.intervalMonths,
            lastDoseDate: form.lastDoseDate,
            nextDoseDate,
          }
        : {}),
    };
    console.log('Új gyógyszer/kiegészítő:', result);
    onAdd(result);
    setForm(createInitialForm());
    onClose();
  };

  const close = () => {
    setForm(createInitialForm());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoider}>
          <BlurView intensity={58} tint="dark" style={styles.modalGlass}>
            <View style={styles.modalTint}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.eyebrow}>SZERVEZŐ</Text>
                  <Text style={styles.title}>Új gyógyszer vagy kiegészítő</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bezárás"
                  hitSlop={10}
                  onPress={close}
                  style={styles.closeButton}>
                  <X size={18} color="#D8B4FE" />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.content}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Alapadatok</Text>
                  <FloatingInput
                    label="Név"
                    value={form.name}
                    onChangeText={(value) => update('name', value)}
                    placeholder="Mesalamine vagy Kreatin"
                  />
                  <FloatingInput
                    label="Adagolás"
                    value={form.dose}
                    onChangeText={(value) => update('dose', value)}
                    placeholder="800mg vagy 1 kanál"
                  />
                  <FloatingInput
                    label="Mióta szedi?"
                    value={form.since}
                    onChangeText={(value) => update('since', value)}
                    placeholder="ÉÉÉÉ-HH-NN"
                  />

                  <Text style={styles.fieldLabel}>Típus</Text>
                  <View style={styles.typeRow}>
                    {[
                      { id: 'pill', emoji: '💊', label: 'Gyógyszer' },
                      {
                        id: 'supplement',
                        emoji: '⚡',
                        label: 'Kiegészítő',
                      },
                      {
                        id: 'biologic',
                        emoji: '🧬',
                        label: 'Biológiai terápia',
                      },
                    ].map((option) => {
                      const id = option.id as NewMedicationInput['type'];
                      const selected = form.type === id;
                      return (
                        <AnimatedOption
                          key={id}
                          selected={selected}
                          accessibilityLabel={option.label}
                          onPress={() => update('type', id)}
                          containerStyle={styles.flexOption}
                          style={[
                            styles.typeCard,
                            selected && styles.selectedCard,
                          ]}>
                          <Text style={styles.typeEmoji}>{option.emoji}</Text>
                          <Text
                            style={[
                              styles.typeLabel,
                              selected && styles.selectedText,
                            ]}>
                            {option.label}
                          </Text>
                        </AnimatedOption>
                      );
                    })}
                  </View>
                </View>

                {isBiologic ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Kezelés ütemezése</Text>

                    <Text style={styles.fieldLabel}>Hol kapod?</Text>
                    <View style={styles.typeRow}>
                      {[
                        { id: 'home', label: 'Otthon', emoji: '🏠' },
                        { id: 'hospital', label: 'Kórházban', emoji: '🏥' },
                      ].map((option) => {
                        const id = option.id as 'home' | 'hospital';
                        const selected =
                          form.administrationLocation === id;
                        return (
                          <AnimatedOption
                            key={id}
                            selected={selected}
                            accessibilityLabel={option.label}
                            onPress={() =>
                              update('administrationLocation', id)
                            }
                            containerStyle={styles.flexOption}
                            style={[
                              styles.typeCard,
                              selected && styles.selectedCard,
                            ]}>
                            <Text style={styles.typeEmoji}>{option.emoji}</Text>
                            <Text
                              style={[
                                styles.typeLabel,
                                selected && styles.selectedText,
                              ]}>
                              {option.label}
                            </Text>
                          </AnimatedOption>
                        );
                      })}
                    </View>

                    <Text style={styles.fieldLabel}>Hány havonta kapod?</Text>
                    <View style={styles.timeRow}>
                      {([1, 2, 3] as const).map((months) => {
                        const selected = form.intervalMonths === months;
                        return (
                          <AnimatedOption
                            key={months}
                            selected={selected}
                            accessibilityLabel={`${months} havonta`}
                            onPress={() => update('intervalMonths', months)}
                            containerStyle={styles.flexOption}
                            style={[
                              styles.timeChip,
                              selected && styles.selectedChip,
                            ]}>
                            <Text
                              style={[
                                styles.timeLabel,
                                selected && styles.selectedText,
                              ]}>
                              {months} havonta
                            </Text>
                          </AnimatedOption>
                        );
                      })}
                    </View>

                    <FloatingInput
                      label="Mikor volt az utolsó kezelés?"
                      value={form.lastDoseDate}
                      onChangeText={(value) => update('lastDoseDate', value)}
                      placeholder="ÉÉÉÉ-HH-NN"
                    />

                    {nextDoseDate ? (
                      <View style={styles.nextDoseCard}>
                        <Text style={styles.nextDoseEyebrow}>
                          KÖVETKEZŐ VÁRHATÓ KEZELÉS
                        </Text>
                        <Text style={styles.nextDoseDate}>
                          {new Date(
                            `${nextDoseDate}T12:00:00`,
                          ).toLocaleDateString('hu-HU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Text>
                        <Text style={styles.nextDoseHint}>
                          Ezt a napot automatikusan beírjuk a Szervező
                          naptárába.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Időpontok</Text>
                  <Text style={styles.sectionHint}>
                    Több időpontot is kiválaszthatsz.
                  </Text>
                  <View style={styles.timeRow}>
                    {TIME_OPTIONS.map((option) => {
                      const selected = form.times.includes(option.time);
                      return (
                        <AnimatedOption
                          key={option.time}
                          selected={selected}
                          accessibilityLabel={`${option.label}, ${option.time}`}
                          onPress={() => toggleTime(option.time)}
                          containerStyle={styles.flexOption}
                          style={[
                            styles.timeChip,
                            selected && styles.selectedChip,
                          ]}>
                          <Text
                            style={[
                              styles.timeLabel,
                              selected && styles.selectedText,
                            ]}>
                            {option.label}
                          </Text>
                          <Text
                            style={[
                              styles.timeValue,
                              selected && styles.selectedSubtext,
                            ]}>
                            {option.time}
                          </Text>
                        </AnimatedOption>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Készletkezelés</Text>
                  <FloatingInput
                    label="Jelenlegi készlet (Hány adag van a dobozban?)"
                    value={form.inventory}
                    onChangeText={(value) =>
                      update('inventory', value.replace(/\D/g, ''))
                    }
                    placeholder="30"
                    keyboardType="number-pad"
                  />
                  <View style={styles.quickRow}>
                    {[30, 60, 90].map((amount) => {
                      const selected = inventory === amount;
                      return (
                        <AnimatedOption
                          key={amount}
                          selected={selected}
                          accessibilityLabel={`${amount} adag`}
                          onPress={() => update('inventory', String(amount))}
                          style={[
                            styles.quickButton,
                            selected && styles.quickButtonSelected,
                          ]}>
                          <Text
                            style={[
                              styles.quickText,
                              selected && styles.selectedText,
                            ]}>
                            +{amount}
                          </Text>
                        </AnimatedOption>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Értesítési küszöb</Text>
                  <Text style={styles.fieldLabel}>
                    Mikor szóljon Flóra az újrarendelésről?
                  </Text>
                  <View style={styles.stepper}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Küszöb csökkentése"
                      disabled={form.refillThreshold <= 1}
                      onPress={() =>
                        update(
                          'refillThreshold',
                          Math.max(1, form.refillThreshold - 1),
                        )
                      }
                      style={[
                        styles.stepperButton,
                        form.refillThreshold <= 1 && styles.disabled,
                      ]}>
                      <Minus size={20} color="#C4B5FD" />
                    </Pressable>
                    <View style={styles.stepperValueWrap}>
                      <Text style={styles.stepperValue}>
                        {form.refillThreshold}
                      </Text>
                      <Text style={styles.stepperUnit}>adag</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Küszöb növelése"
                      onPress={() =>
                        update(
                          'refillThreshold',
                          Math.min(30, form.refillThreshold + 1),
                        )
                      }
                      style={styles.stepperButton}>
                      <Plus size={20} color="#C4B5FD" />
                    </Pressable>
                  </View>
                  <Text style={styles.floraHint}>
                    Flóra értesíteni fog, ha már csak{' '}
                    <Text style={styles.floraHintStrong}>
                      {form.refillThreshold} adag
                    </Text>{' '}
                    maradt.
                  </Text>
                </View>
                  </>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hozzáadás"
                  disabled={!canSave}
                  onPress={save}
                  style={({ pressed }) => [
                    styles.saveButton,
                    !canSave && styles.saveDisabled,
                    pressed && canSave && { transform: [{ scale: 0.98 }] },
                  ]}>
                  <Text style={styles.saveText}>Hozzáadás</Text>
                </Pressable>
              </ScrollView>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3,1,12,0.72)',
  },
  keyboardAvoider: {
    maxHeight: '92%',
  },
  modalGlass: {
    maxHeight: '100%',
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(196,181,253,0.22)',
    backgroundColor: 'rgba(20,11,46,0.9)',
  },
  modalTint: {
    maxHeight: '100%',
    backgroundColor: 'rgba(22,11,52,0.58)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(196,181,253,0.1)',
  },
  eyebrow: {
    color: violet[400],
    fontFamily: font.bodySemi,
    fontSize: 10,
    letterSpacing: 1.8,
    marginBottom: 3,
  },
  title: {
    color: '#fff',
    fontFamily: font.displayX,
    fontSize: 18,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    gap: 24,
  },
  section: {
    gap: 13,
  },
  sectionTitle: {
    color: '#F5F3FF',
    fontFamily: font.display,
    fontSize: 15,
  },
  sectionHint: {
    color: 'rgba(255,255,255,0.42)',
    fontFamily: font.body,
    fontSize: 11,
    marginTop: -9,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontFamily: font.bodySemi,
    fontSize: 12,
  },
  floatingField: {
    position: 'relative',
    paddingTop: 8,
  },
  floatingLabel: {
    position: 'absolute',
    top: 0,
    left: 13,
    zIndex: 2,
    paddingHorizontal: 5,
    color: violet[300],
    backgroundColor: '#1B0F3D',
    fontFamily: font.bodySemi,
    fontSize: 10,
  },
  input: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    paddingHorizontal: 15,
    paddingTop: 13,
    color: '#fff',
    fontFamily: font.bodyMedium,
    fontSize: 14,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexOption: {
    flex: 1,
  },
  typeCard: {
    width: '100%',
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  selectedCard: {
    borderColor: violet[400],
    backgroundColor: 'rgba(124,58,237,0.28)',
    shadowColor: violet[500],
    shadowOpacity: 0.5,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  typeEmoji: {
    fontSize: 20,
  },
  typeLabel: {
    color: 'rgba(255,255,255,0.48)',
    fontFamily: font.display,
    fontSize: 12,
    textAlign: 'center',
  },
  selectedText: {
    color: '#fff',
  },
  selectedSubtext: {
    color: '#D8B4FE',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeChip: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  selectedChip: {
    borderColor: violet[400],
    backgroundColor: 'rgba(124,58,237,0.28)',
  },
  timeLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: font.display,
    fontSize: 12,
  },
  timeValue: {
    color: 'rgba(255,255,255,0.3)',
    fontFamily: font.body,
    fontSize: 10,
    marginTop: 2,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    minWidth: 70,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  quickButtonSelected: {
    borderColor: violet[400],
    backgroundColor: 'rgba(124,58,237,0.3)',
  },
  quickText: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: font.display,
    fontSize: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  stepperButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.2)',
    backgroundColor: 'rgba(124,58,237,0.17)',
  },
  disabled: {
    opacity: 0.35,
  },
  stepperValueWrap: {
    alignItems: 'center',
  },
  stepperValue: {
    color: '#fff',
    fontFamily: font.displayX,
    fontSize: 26,
    lineHeight: 29,
  },
  stepperUnit: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: font.body,
    fontSize: 10,
  },
  floraHint: {
    color: 'rgba(255,255,255,0.48)',
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 17,
  },
  floraHintStrong: {
    color: violet[300],
    fontFamily: font.bodySemi,
  },
  nextDoseCard: {
    padding: 16,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.32)',
    backgroundColor: 'rgba(124,58,237,0.17)',
  },
  nextDoseEyebrow: {
    color: violet[400],
    fontFamily: font.bodySemi,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  nextDoseDate: {
    color: '#fff',
    fontFamily: font.displayX,
    fontSize: 19,
    marginTop: 5,
  },
  nextDoseHint: {
    color: 'rgba(255,255,255,0.46)',
    fontFamily: font.body,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  saveButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: violet[600],
    borderWidth: 1,
    borderColor: violet[400],
    shadowColor: violet[500],
    shadowOpacity: 0.75,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 9,
  },
  saveDisabled: {
    opacity: 0.4,
  },
  saveText: {
    color: '#fff',
    fontFamily: font.displayX,
    fontSize: 16,
  },
});
