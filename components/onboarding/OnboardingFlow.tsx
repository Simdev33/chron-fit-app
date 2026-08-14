import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronLeft, Target } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import { useHealthLog } from '@/context/HealthLogContext';
import {
  diagnosisLabels,
  goalOptions,
  phaseLabels,
  triggerFoodOptions,
  type Diagnosis,
  type Phase,
  useProfile,
} from '@/context/ProfileContext';

const STEP_COUNT = 6;
const MAX_TRIGGERS = 5;

const diagnosisOptions: { value: Diagnosis; description: string }[] = [
  { value: 'crohn', description: 'A tápcsatorna bármely szakaszát érintheti.' },
  { value: 'uc', description: 'A vastagbél nyálkahártyáját érinti.' },
  {
    value: 'ibdu',
    description: 'Gyulladásos bélbetegség pontos besorolás nélkül.',
  },
];

const phaseOptions: { value: Phase; emoji: string; description: string }[] = [
  {
    value: 'remission',
    emoji: '✨',
    description: 'Tünetmentes vagy enyhe időszak — építkezhetünk.',
  },
  {
    value: 'flare',
    emoji: '🌡️',
    description: 'Aktív tünetek — kíméletes ajánlásokra váltunk.',
  },
  {
    value: 'unknown',
    emoji: '🤔',
    description: 'Nem vagyok biztos benne — együtt kitaláljuk.',
  },
];

export function OnboardingFlow() {
  const p = usePalette();
  const { profile, completeOnboarding } = useProfile();
  const { resetMedications } = useHealthLog();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [diagnosis, setDiagnosis] = useState<Diagnosis>('crohn');
  const [phase, setPhase] = useState<Phase>('remission');
  const [takesMeds, setTakesMeds] = useState(true);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);

  function toggleTrigger(food: string) {
    setTriggers((prev) => {
      if (prev.includes(food)) return prev.filter((f) => f !== food);
      if (prev.length >= MAX_TRIGGERS) return prev;
      return [...prev, food];
    });
  }

  function toggleGoal(goal: string) {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  }

  const canNext = step === 0 ? name.trim().length > 0 : true;

  function next() {
    if (step < STEP_COUNT - 1) {
      setStep(step + 1);
    } else {
      // Új fióknál üres gyógyszerlistával indulunk; ha nem szed gyógyszert,
      // ezt jelezzük is, hogy az app ne kérje a felvételüket.
      resetMedications(!takesMeds);
      completeOnboarding({
        name: name.trim(),
        diagnosis,
        phase,
        triggerFoods: triggers,
        goals,
        noPrescribedMeds: !takesMeds,
      });
    }
  }

  const cardBg = p.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)';
  const cardBorder = p.dark ? 'rgba(255,255,255,0.1)' : 'rgba(196,181,253,0.5)';
  const activeBg = p.dark ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.12)';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      {/* Fejléc: vissza gomb + progress sáv */}
      <View style={styles.topRow}>
        {step > 0 ? (
          <Pressable
            onPress={() => setStep(step - 1)}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: p.chipBg },
              pressed && { transform: [{ scale: 0.9 }] },
            ]}>
            <ChevronLeft size={18} color={p.muted} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.progressRow}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <View
              key={i}
              style={[
                styles.progressSeg,
                {
                  backgroundColor:
                    i <= step
                      ? violet[500]
                      : p.dark
                        ? 'rgba(255,255,255,0.1)'
                        : '#E9D5FF',
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text style={[styles.brand, { color: violet[400] }]}>CrohnFit</Text>

          {step === 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.question, { color: p.text }]}>
                Hogy szólíthatunk?
              </Text>
              <Text style={[styles.hint, { color: p.muted }]}>
                A fiókod: {profile.email || 'ismeretlen email'}
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="A neved"
                placeholderTextColor={p.placeholder}
                style={[
                  styles.nameInput,
                  {
                    color: p.text,
                    backgroundColor: cardBg,
                    borderColor: name.trim() ? violet[500] : cardBorder,
                  },
                ]}
              />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.question, { color: p.text }]}>
                Mi a diagnózisod?
              </Text>
              <Text style={[styles.hint, { color: p.muted }]}>
                Ez segít személyre szabni a gondozási tervedet.
              </Text>
              <View style={{ gap: 12, marginTop: 8 }}>
                {diagnosisOptions.map((opt) => {
                  const active = diagnosis === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setDiagnosis(opt.value)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        {
                          backgroundColor: active ? activeBg : cardBg,
                          borderColor: active ? violet[500] : cardBorder,
                        },
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.optionTitle, { color: p.text }]}>
                          {diagnosisLabels[opt.value]}
                        </Text>
                        <Text style={[styles.optionDesc, { color: p.muted }]}>
                          {opt.description}
                        </Text>
                      </View>
                      {active ? <Check size={20} color={violet[400]} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.question, { color: p.text }]}>
                Mi az aktuális státuszod?
              </Text>
              <Text style={[styles.hint, { color: p.muted }]}>
                Ehhez igazítjuk az ajánlásainkat.
              </Text>
              <View style={{ gap: 12, marginTop: 8 }}>
                {phaseOptions.map((opt) => {
                  const active = phase === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setPhase(opt.value)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        {
                          backgroundColor: active ? activeBg : cardBg,
                          borderColor: active ? violet[500] : cardBorder,
                        },
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}>
                      <Text style={{ fontSize: 24 }}>{opt.emoji}</Text>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.optionTitle, { color: p.text }]}>
                          {phaseLabels[opt.value]}
                        </Text>
                        <Text style={[styles.optionDesc, { color: p.muted }]}>
                          {opt.description}
                        </Text>
                      </View>
                      {active ? <Check size={20} color={violet[400]} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.question, { color: p.text }]}>
                Szedsz rendszeresen gyógyszert?
              </Text>
              <Text style={[styles.hint, { color: p.muted }]}>
                Ha igen, az app szervezőjében tudod majd vezetni őket —
                emlékeztetőkkel.
              </Text>
              <View style={{ gap: 12, marginTop: 8 }}>
                {(
                  [
                    {
                      value: true,
                      emoji: '💊',
                      title: 'Igen, szedek',
                      desc: 'A gyógyszereidet a Szervező fülön veheted fel, miután végeztünk.',
                    },
                    {
                      value: false,
                      emoji: '🙌',
                      title: 'Nem szedek gyógyszert',
                      desc: 'Semmi gond — ha ez változik, bármikor felvehetsz újat a Szervezőben.',
                    },
                  ] as const
                ).map((opt) => {
                  const active = takesMeds === opt.value;
                  return (
                    <Pressable
                      key={String(opt.value)}
                      onPress={() => setTakesMeds(opt.value)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        {
                          backgroundColor: active ? activeBg : cardBg,
                          borderColor: active ? violet[500] : cardBorder,
                        },
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}>
                      <Text style={{ fontSize: 24 }}>{opt.emoji}</Text>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.optionTitle, { color: p.text }]}>
                          {opt.title}
                        </Text>
                        <Text style={[styles.optionDesc, { color: p.muted }]}>
                          {opt.desc}
                        </Text>
                      </View>
                      {active ? <Check size={20} color={violet[400]} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 4 ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.question, { color: p.text }]}>
                Mik a fő triggereid?
              </Text>
              <Text style={[styles.hint, { color: p.muted }]}>
                Válaszd ki azokat az ételeket, amik nálad biztosan panaszt
                okoznak — legfeljebb {MAX_TRIGGERS}-öt. ({triggers.length}/
                {MAX_TRIGGERS})
              </Text>
              <View style={styles.chipWrap}>
                {triggerFoodOptions.map((food) => {
                  const active = triggers.includes(food);
                  return (
                    <Pressable
                      key={food}
                      onPress={() => toggleTrigger(food)}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: active ? violet[600] : cardBg,
                          borderColor: active ? violet[600] : cardBorder,
                        },
                        pressed && { transform: [{ scale: 0.95 }] },
                      ]}>
                      <Text
                        style={{
                          color: active ? '#fff' : p.text,
                          fontSize: 14,
                          fontFamily: font.bodySemi,
                        }}>
                        {food}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 5 ? (
            <View style={{ gap: 8 }}>
              <Text style={[styles.question, { color: p.text }]}>
                Mi a célod?
              </Text>
              <Text style={[styles.hint, { color: p.muted }]}>
                Több célt is választhatsz — ezekre fókuszálunk majd.
              </Text>
              <View style={{ gap: 12, marginTop: 8 }}>
                {goalOptions.map((goal) => {
                  const active = goals.includes(goal);
                  return (
                    <Pressable
                      key={goal}
                      onPress={() => toggleGoal(goal)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        {
                          backgroundColor: active ? activeBg : cardBg,
                          borderColor: active ? violet[500] : cardBorder,
                        },
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}>
                      <View
                        style={[
                          styles.goalIcon,
                          {
                            backgroundColor: active
                              ? violet[600]
                              : 'rgba(139,92,246,0.2)',
                          },
                        ]}>
                        <Target
                          size={16}
                          color={active ? '#fff' : violet[400]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.optionTitle,
                          { color: p.text, flex: 1 },
                        ]}>
                        {goal}
                      </Text>
                      {active ? <Check size={20} color={violet[400]} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {canNext ? (
            <Pressable
              onPress={next}
              style={({ pressed }) => [
                { borderRadius: 999, overflow: 'hidden' },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}>
              <LinearGradient
                colors={[violet[600], '#9333EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextBtn}>
                <Text style={styles.nextLabel}>
                  {step < STEP_COUNT - 1 ? 'Tovább' : 'Kezdjük!'}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View
              style={[
                styles.nextBtn,
                {
                  backgroundColor: p.dark
                    ? 'rgba(255,255,255,0.08)'
                    : '#F3E8FF',
                },
              ]}>
              <Text style={[styles.nextLabel, { color: p.faint }]}>
                Tovább
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 24,
  },
  brand: {
    fontSize: 22,
    fontFamily: font.displayX,
    letterSpacing: 0.5,
  },
  question: {
    fontSize: 26,
    fontFamily: font.displayX,
    lineHeight: 32,
  },
  hint: {
    fontSize: 14,
    fontFamily: font.body,
    lineHeight: 20,
  },
  nameInput: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: font.bodyMedium,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 18,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: font.display,
  },
  optionDesc: {
    fontSize: 13,
    fontFamily: font.body,
    lineHeight: 18,
  },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  footer: {
    padding: 24,
    paddingTop: 8,
  },
  nextBtn: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: font.display,
  },
});
