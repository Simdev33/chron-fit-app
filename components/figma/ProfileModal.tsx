import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import {
  Camera,
  ChevronLeft,
  FileText,
  FileUp,
  Package,
  Pill,
  Plus,
  Syringe,
  Trash2,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassCard,
  SectionHeader,
  TagInput,
  TogglePill,
  useKeyboardHeight,
  usePalette,
} from '@/components/figma/ui';
import { DocumentImportSheet } from '@/components/figma/DocumentImportSheet';
import { confirmDestructive } from '@/utils/confirmDialog';
import { deleteDocument } from '@/utils/documentStore';
import { AddMedicationModal } from '@/components/organizer/AddMedicationModal';
import { AVATAR_COLORS, blue, font, violet } from '@/constants/figma';
import { useHealthLog } from '@/context/HealthLogContext';
import {
  type Diagnosis,
  diagnosisLabels,
  type ImportedDocument,
  useProfile,
} from '@/context/ProfileContext';

const SEGMENTS = [
  'Terminális ileum',
  'Vakbél',
  'Felszálló vastagbél',
  'Haránt vastagbél',
  'Leszálló vastagbél',
  'Szigmabél',
  'Végbél',
];

const CONDITIONS = ['Crohn-betegség', 'Colitis ulcerosa', 'IBD – nem besorolt'];
const STOMA_TYPES = ['Ileosztóma', 'Kolosztóma', 'Urosztóma'];
const FIBER_LABELS = ['Nagyon alacsony', 'Alacsony', 'Közepes', 'Magas', 'Nagyon magas'];
const DIET_APPROACHES = [
  { id: 'low-residue', label: 'Salakszegény' },
  { id: 'standard', label: 'Normál' },
  { id: 'high-fiber', label: 'Rostdús' },
];
const FOCUS = [
  { id: 'weightlifting', label: 'Súlyzós', icon: '🏋️' },
  { id: 'cardio', label: 'Kardió', icon: '🏃' },
  { id: 'bodyweight', label: 'Saját testsúly', icon: '💪' },
  { id: 'yoga', label: 'Jóga', icon: '🧘' },
  { id: 'swimming', label: 'Úszás', icon: '🏊' },
  { id: 'cycling', label: 'Kerékpár', icon: '🚴' },
];

export function ProfileModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { profile, updateProfile } = useProfile();
  const { log, addMedication, removeMedication } = useHealthLog();
  const remission = profile.phase === 'remission';

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [age, setAge] = useState(profile.age);
  const [weight, setWeight] = useState(profile.weightKg);
  const [height, setHeight] = useState(profile.heightCm);
  const [colorIdx, setColorIdx] = useState(profile.avatarColorIdx);
  const [condition, setCondition] = useState(
    diagnosisLabels[profile.diagnosis] ?? CONDITIONS[0],
  );
  const [segments, setSegments] = useState<string[]>(profile.resectedSegments);
  const [triggers, setTriggers] = useState<string[]>(profile.triggerFoods);
  const [addMedicationOpen, setAddMedicationOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [noTriggers, setNoTriggers] = useState(profile.noTriggerFoods);
  const [stoma, setStoma] = useState(profile.hasStoma);
  const [stomaType, setStomaType] = useState(profile.stomaType);
  const [surgery, setSurgery] = useState(profile.hadSurgery);
  const [surgeryText, setSurgeryText] = useState(profile.surgeryNotes);
  const [joints, setJoints] = useState(profile.jointSymptoms);
  const [skin, setSkin] = useState(profile.skinSymptoms);
  const [fiber, setFiber] = useState(profile.fiberTolerance);
  const [dietApproach, setDietApproach] = useState(profile.dietApproach);
  const [frequency, setFrequency] = useState(profile.workoutFrequency || 3);
  const [focus, setFocus] = useState<string[]>(profile.workoutFocus);
  const [noExercise, setNoExercise] = useState(profile.noExercise);

  // A mezőket csak megnyitáskor töltjük a profilból, gépelés közben nem.
  useEffect(() => {
    if (!visible) return;
    setName(profile.name);
    setEmail(profile.email);
    setAge(profile.age);
    setWeight(profile.weightKg);
    setHeight(profile.heightCm);
    setColorIdx(profile.avatarColorIdx);
    setCondition(diagnosisLabels[profile.diagnosis] ?? CONDITIONS[0]);
    setTriggers(profile.triggerFoods);
    setNoTriggers(profile.noTriggerFoods);
    setFrequency(profile.workoutFrequency || 3);
    setFocus(profile.workoutFocus);
    setNoExercise(profile.noExercise);
    setSegments(profile.resectedSegments);
    setStoma(profile.hasStoma);
    setStomaType(profile.stomaType);
    setSurgery(profile.hadSurgery);
    setSurgeryText(profile.surgeryNotes);
    setJoints(profile.jointSymptoms);
    setSkin(profile.skinSymptoms);
    setFiber(profile.fiberTolerance);
    setDietApproach(profile.dietApproach);
  }, [visible]);

  const removeDocument = (doc: ImportedDocument) => {
    confirmDestructive({
      title: 'Dokumentum törlése',
      message:
        'A fájl és az összefoglaló törlődik. A profilba már bemásolt adatok megmaradnak.',
      onConfirm: () => {
        deleteDocument(doc.fileUri);
        const rest = profile.importedDocuments.filter((d) => d.id !== doc.id);
        updateProfile({
          importedDocuments: rest,
          // Flora's context follows the newest surviving import.
          documentSummary: rest[0]?.summary ?? '',
        });
      },
    });
  };

  const flushAndClose = () => {
    updateProfile({
      name: name.trim() || profile.name,
      email: email.trim(),
      age,
      weightKg: weight,
      heightCm: height,
      // These used to live only in component state, so everything the user
      // entered here was thrown away the moment the sheet closed.
      resectedSegments: segments,
      hasStoma: stoma,
      stomaType: stoma ? stomaType : '',
      hadSurgery: surgery,
      surgeryNotes: surgery ? surgeryText : '',
      jointSymptoms: joints,
      skinSymptoms: skin,
      fiberTolerance: fiber,
      dietApproach,
    });
    onClose();
  };

  const commitTriggers = (next: string[], none: boolean) => {
    const list = none ? [] : next;
    setTriggers(list);
    setNoTriggers(none);
    updateProfile({ triggerFoods: list, noTriggerFoods: none });
  };

  const setPhase = (phase: 'remission' | 'flare') => updateProfile({ phase });

  const diagnosisFromLabel = (label: string): Diagnosis => {
    const found = (Object.keys(diagnosisLabels) as Diagnosis[]).find(
      (key) => diagnosisLabels[key] === label,
    );
    return found ?? 'crohn';
  };

  const toggleIn = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const inputStyle = {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: font.body,
    color: p.text,
    backgroundColor: p.fieldBgStrong,
    borderWidth: 1,
    borderColor: p.fieldBorder,
  } as const;

  const smallLabel = {
    fontSize: 11,
    fontFamily: font.bodySemi,
    marginBottom: 6,
    color: p.muted,
  } as const;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={flushAndClose}
      presentationStyle="fullScreen">
      <KeyboardAvoidingView
        style={{
          flex: 1,
          backgroundColor: p.bg,
          paddingBottom: keyboardHeight,
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 8, borderBottomColor: p.divider },
          ]}>
          <Pressable
            onPress={flushAndClose}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ChevronLeft size={20} color={p.muted} />
            <Text
              style={{ fontSize: 14, fontFamily: font.bodySemi, color: p.muted }}>
              Vissza
            </Text>
          </Pressable>
          <Text
            style={{ fontFamily: font.displayX, fontSize: 16, color: p.text }}>
            Profilom
          </Text>
          <Pressable onPress={flushAndClose}>
            <LinearGradient
              colors={[violet[600], violet[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveChip}>
              <Text
                style={{ fontFamily: font.display, fontSize: 12, color: '#fff' }}>
                Kész
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {/* Profilkép */}
          <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
            <Text
              style={{
                fontFamily: font.bodySemi,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 2,
                marginBottom: 16,
                color: p.dark ? violet[400] : violet[600],
              }}>
              Profilkép
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <LinearGradient
                colors={AVATAR_COLORS[colorIdx]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bigAvatar}>
                <Text
                  style={{
                    fontFamily: font.displayX,
                    fontSize: 30,
                    color: '#fff',
                  }}>
                  {(name || 'A')[0].toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: 8,
                    padding: 4,
                    paddingBottom: 12,
                  }}>
                  {AVATAR_COLORS.map((c, idx) => (
                    <Pressable
                      key={idx}
                      onPress={() => {
                        setColorIdx(idx);
                        updateProfile({ avatarColorIdx: idx });
                      }}>
                      <LinearGradient
                        colors={c}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                          styles.colorSwatch,
                          colorIdx === idx
                            ? {
                                borderWidth: 2,
                                borderColor: violet[400],
                                transform: [{ scale: 1.1 }],
                              }
                            : { opacity: 0.6 },
                        ]}>
                        <Text
                          style={{
                            fontFamily: font.display,
                            fontSize: 14,
                            color: '#fff',
                          }}>
                          {(name || 'A')[0].toUpperCase()}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    alignSelf: 'flex-start',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: p.dark
                      ? 'rgba(255,255,255,0.15)'
                      : '#E9D5FF',
                    backgroundColor: p.fieldBg,
                  }}>
                  <Camera size={13} color={p.muted} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.bodySemi,
                      color: p.muted,
                    }}>
                    Fotó feltöltése
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Egészségi állapot */}
          <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
            <LinearGradient
              colors={
                remission
                  ? ['rgba(124,58,237,0.55)', 'rgba(109,40,217,0.35)']
                  : ['rgba(59,130,246,0.45)', 'rgba(37,99,235,0.3)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: remission
                  ? 'rgba(167,139,250,0.3)'
                  : 'rgba(147,197,253,0.3)',
              }}>
              <Text style={styles.cardEyebrow}>Jelenlegi egészségi állapot</Text>
              <Text
                style={{
                  fontFamily: font.displayX,
                  fontSize: 18,
                  color: '#fff',
                  marginBottom: 12,
                }}>
                {remission ? '✨ Jelenleg remisszióban' : '🌡️ Aktív fellángolás'}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: font.body,
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: 16,
                }}>
                {remission
                  ? 'Az Életfa virágzik. Csak így tovább!'
                  : 'Fellángolás mód aktív. Az ajánlásokat a komfortodhoz igazítottuk.'}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 4,
                  padding: 4,
                  borderRadius: 16,
                  backgroundColor: p.dark
                    ? 'rgba(0,0,0,0.2)'
                    : 'rgba(0,0,0,0.1)',
                }}>
                {(['remission', 'flare'] as const).map((phase) => {
                  const active = profile.phase === phase;
                  return (
                    <Pressable
                      key={phase}
                      onPress={() => setPhase(phase)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: active ? '#fff' : 'transparent',
                      }}>
                      <Text
                        style={{
                          fontFamily: font.display,
                          fontSize: 14,
                          color: active
                            ? phase === 'remission'
                              ? violet[700]
                              : blue[600]
                            : 'rgba(255,255,255,0.6)',
                        }}>
                        {phase === 'remission'
                          ? '✨ Remisszió'
                          : '🌡️ Fellángolás'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </LinearGradient>
          </View>

          {/* Importálás a kézi kitöltés előtt: itt éri a felhasználót a
              nyolc szekciónyi orvosi adat kitöltésének terhe. */}
          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dokumentum feltöltése"
              onPress={() => setDocumentOpen(true)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: p.dark ? 'rgba(167,139,250,0.4)' : '#DDD6FE',
                  backgroundColor: p.dark
                    ? 'rgba(167,139,250,0.08)'
                    : '#FAF5FF',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <FileUp size={22} color={violet[400]} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: font.display,
                    fontSize: 14,
                    color: p.text,
                  }}>
                  Van zárójelentésed?
                </Text>
                <Text
                  style={{
                    fontFamily: font.body,
                    fontSize: 12,
                    color: p.muted,
                    marginTop: 2,
                  }}>
                  Töltsd fel, és kitöltöm belőle amit tudok.
                </Text>
              </View>
            </Pressable>
          </View>

          {profile.importedDocuments.length > 0 ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 10 }}>
              <Text
                style={{
                  fontFamily: font.bodySemi,
                  fontSize: 12,
                  color: p.muted,
                }}>
                Feltöltött dokumentumok
              </Text>
              {profile.importedDocuments.map((doc) => (
                <ImportedDocumentCard
                  key={doc.id}
                  doc={doc}
                  onRemove={() => removeDocument(doc)}
                />
              ))}
            </View>
          ) : null}

          {/* Alapadatok */}
          <SectionHeader title="Alapadatok" />
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={smallLabel}>Teljes név</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onBlur={() =>
                    updateProfile({ name: name.trim() || profile.name })
                  }
                  placeholder="Neved"
                  placeholderTextColor={p.placeholder}
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={smallLabel}>Életkor</Text>
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  onBlur={() => updateProfile({ age })}
                  placeholder="Év"
                  keyboardType="numeric"
                  placeholderTextColor={p.placeholder}
                  style={inputStyle}
                />
              </View>
            </View>
            <View>
              <Text style={smallLabel}>E-mail</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onBlur={() => updateProfile({ email: email.trim() })}
                placeholder="E-mail cím"
                keyboardType="email-address"
                placeholderTextColor={p.placeholder}
                style={inputStyle}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={smallLabel}>Testsúly (kg)</Text>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  onBlur={() => updateProfile({ weightKg: weight })}
                  placeholder="kg"
                  keyboardType="numeric"
                  placeholderTextColor={p.placeholder}
                  style={inputStyle}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={smallLabel}>Magasság (cm)</Text>
                <TextInput
                  value={height}
                  onChangeText={setHeight}
                  onBlur={() => updateProfile({ heightCm: height })}
                  placeholder="cm"
                  keyboardType="numeric"
                  placeholderTextColor={p.placeholder}
                  style={inputStyle}
                />
              </View>
            </View>
          </View>

          {/* Diagnózis */}
          <SectionHeader
            title="Diagnózis"
            subtitle="Segít személyre szabni az étrend- és mozgástanácsokat"
          />
          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            <View>
              <Text style={smallLabel}>Betegség</Text>
              <View style={{ gap: 8 }}>
                {CONDITIONS.map((c) => {
                  const active = condition === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        setCondition(c);
                        updateProfile({ diagnosis: diagnosisFromLabel(c) });
                      }}
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
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          borderWidth: 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderColor: active
                            ? violet[500]
                            : p.dark
                              ? 'rgba(255,255,255,0.3)'
                              : '#D8B4FE',
                          backgroundColor: active ? violet[500] : 'transparent',
                        }}>
                        {active ? (
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              backgroundColor: '#fff',
                            }}
                          />
                        ) : null}
                      </View>
                      <Text
                        style={{
                          fontSize: 14,
                          fontFamily: active ? font.bodySemi : font.body,
                          color: active
                            ? p.dark
                              ? violet[300]
                              : violet[700]
                            : p.dark
                              ? 'rgba(255,255,255,0.7)'
                              : '#1A0D35',
                        }}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View>
              <Text style={smallLabel}>
                Érintett bélszakaszok{' '}
                <Text style={{ fontFamily: font.body }}>
                  (több is jelölhető)
                </Text>
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SEGMENTS.map((s) => {
                  const active = segments.includes(s);
                  return (
                    <Pressable
                      key={s}
                      onPress={() => toggleIn(segments, setSegments, s)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 2,
                        borderColor: active ? violet[500] : p.fieldBorder,
                        backgroundColor: active
                          ? 'rgba(139,92,246,0.2)'
                          : p.fieldBg,
                      }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: font.bodySemi,
                          color: active
                            ? p.dark
                              ? violet[300]
                              : violet[700]
                            : p.muted,
                        }}>
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Gyógyszerek */}
          <SectionHeader
            title="Gyógyszerek és étrend-kiegészítők"
            subtitle="Ugyanaz a lista jelenik meg a Szervező idővonalán is"
          />
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {log.medications.map((medication) => {
              const ItemIcon =
                medication.type === 'pill'
                  ? Pill
                  : medication.type === 'biologic'
                    ? Syringe
                    : Package;
              return (
                <GlassCard key={medication.id} style={{ padding: 14 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                    <View
                      style={[
                        styles.medicationIcon,
                        {
                          backgroundColor:
                            medication.type === 'pill'
                              ? 'rgba(139,92,246,0.2)'
                              : medication.type === 'biologic'
                                ? 'rgba(217,70,239,0.2)'
                              : 'rgba(99,102,241,0.2)',
                        },
                      ]}>
                      <ItemIcon size={18} color={violet[400]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: p.text,
                          fontFamily: font.display,
                          fontSize: 14,
                        }}>
                        {medication.name}
                      </Text>
                      <Text
                        style={{
                          color: p.muted,
                          fontFamily: font.body,
                          fontSize: 11,
                          marginTop: 2,
                        }}>
                        {medication.dose} ·{' '}
                        {medication.type === 'biologic'
                          ? `${
                              medication.administrationLocation === 'hospital'
                                ? 'Kórházban'
                                : 'Otthon'
                            } · ${medication.intervalMonths ?? 1} havonta`
                          : medication.times.join(', ')}
                      </Text>
                      <Text
                        style={{
                          color: p.faint,
                          fontFamily: font.body,
                          fontSize: 10,
                          marginTop: 3,
                        }}>
                        Mióta szedi: {medication.since || 'nincs megadva'}
                        {medication.type === 'biologic'
                          ? ` · Következő: ${
                              medication.nextDoseDate ?? 'nincs kiszámítva'
                            }`
                          : ` · ${medication.inventoryRemaining} adag`}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${medication.name} törlése`}
                      hitSlop={8}
                      onPress={() => removeMedication(medication.id)}
                      style={styles.medicationDelete}>
                      <Trash2 size={15} color="#F87171" />
                    </Pressable>
                  </View>
                </GlassCard>
              );
            })}

            <Pressable
              onPress={() => setAddMedicationOpen(true)}
              style={({ pressed }) => [
                styles.addMedicationButton,
                pressed && { transform: [{ scale: 0.98 }] },
              ]}>
              <Plus size={17} color="#fff" strokeWidth={2.5} />
              <Text style={styles.addMedicationText}>
                Új gyógyszer vagy kiegészítő
              </Text>
            </Pressable>
          </View>

          {/* Trigger ételek */}
          <SectionHeader
            title="Trigger ételek"
            subtitle="Ételek, amelyek rendszeresen rontják a tüneteidet"
          />
          <View style={{ paddingHorizontal: 20 }}>
            <TagInput
              tags={triggers}
              setTags={(next) => commitTriggers(next, false)}
              placeholder="pl. tejtermék, magvak, alkohol"
              noneLabel="Nincs ismert triggerem"
              noneActive={noTriggers}
              onNoneChange={(none) =>
                commitTriggers(none ? [] : triggers, none)
              }
            />
          </View>

          {/* Kórtörténet */}
          <SectionHeader
            title="Kórtörténet és anatómia"
            subtitle="Kritikus háttér a biztonságos edzésajánlásokhoz"
          />
          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            <GlassCard style={{ padding: 16 }}>
              <View style={styles.toggleHead}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: font.display,
                      fontSize: 14,
                      color: p.text,
                    }}>
                    Van jelenleg sztómád?
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.body,
                      color: p.muted,
                      marginTop: 2,
                    }}>
                    A törzsizom-gyakorlatokat és övjavaslatokat ehhez igazítjuk.
                  </Text>
                </View>
                <TogglePill
                  large
                  value={stoma}
                  onChange={(v) => {
                    setStoma(v);
                    if (!v) setStomaType('');
                  }}
                />
              </View>
              {stoma ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={smallLabel}>Sztóma típusa</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {STOMA_TYPES.map((t) => {
                      const active = stomaType === t;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => setStomaType(t)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 12,
                            alignItems: 'center',
                            borderWidth: 2,
                            borderColor: active ? violet[500] : p.fieldBorder,
                            backgroundColor: active
                              ? 'rgba(139,92,246,0.2)'
                              : p.fieldBg,
                          }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: font.display,
                              color: active
                                ? p.dark
                                  ? violet[300]
                                  : violet[700]
                                : p.muted,
                            }}>
                            {t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </GlassCard>

            <GlassCard style={{ padding: 16 }}>
              <View style={styles.toggleHead}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: font.display,
                      fontSize: 14,
                      color: p.text,
                    }}>
                    Korábbi bélműtét vagy reszekció?
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.body,
                      color: p.muted,
                      marginTop: 2,
                    }}>
                    Befolyásolja a has- és törzsizom-, valamint a nehéz emelés
                    tanácsokat.
                  </Text>
                </View>
                <TogglePill
                  large
                  value={surgery}
                  onChange={(v) => {
                    setSurgery(v);
                    if (!v) setSurgeryText('');
                  }}
                />
              </View>
              {surgery ? (
                <TextInput
                  multiline
                  numberOfLines={2}
                  value={surgeryText}
                  onChangeText={setSurgeryText}
                  placeholder="pl. jobb oldali hemikolektómia 2021, ileocökális reszekció…"
                  placeholderTextColor={p.placeholder}
                  style={[
                    inputStyle,
                    { marginTop: 12, minHeight: 64, textAlignVertical: 'top' },
                  ]}
                />
              ) : null}
            </GlassCard>
          </View>

          {/* Társbetegségek */}
          <SectionHeader
            title="Társbetegségek és ízületek"
            subtitle="Gyakori IBD-hez társuló, bélrendszeren kívüli tünetek"
          />
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {(
              [
                [
                  'Ízületi gyulladás vagy artritisz',
                  'IBD-hez társuló ízületi érintettség — befolyásolja a nagy terhelésű edzéseket.',
                  joints,
                  setJoints,
                ],
                [
                  'IBD-hez köthető bőrproblémák',
                  'Pyoderma gangrenosum, erythema nodosum vagy egyéb bőrtünetek.',
                  skin,
                  setSkin,
                ],
              ] as [string, string, boolean, (v: boolean) => void][]
            ).map(([label, desc, val, set]) => (
              <GlassCard key={label} style={{ padding: 16 }}>
                <View style={styles.toggleHead}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: font.display,
                        fontSize: 14,
                        color: p.text,
                      }}>
                      {label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.body,
                        lineHeight: 18,
                        color: p.muted,
                        marginTop: 2,
                      }}>
                      {desc}
                    </Text>
                  </View>
                  <TogglePill large value={val} onChange={set} />
                </View>
              </GlassCard>
            ))}
          </View>

          {/* Étrendi tolerancia */}
          <SectionHeader
            title="Étrendi tolerancia"
            subtitle="Személyre szabott étel- és receptajánlásokhoz"
          />
          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            <GlassCard style={{ padding: 16 }}>
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 14,
                  color: p.text,
                }}>
                Rost-tolerancia
              </Text>
              <View style={[styles.toggleHead, { marginTop: 4, marginBottom: 8 }]}>
                <Text
                  style={{ fontSize: 12, fontFamily: font.body, color: p.muted }}>
                  Mennyire tolerálod az étkezési rostot?
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: font.display,
                    color: violet[400],
                  }}>
                  {FIBER_LABELS[fiber - 1]}
                </Text>
              </View>
              <View style={{ marginHorizontal: '10%' }}>
                <Slider
                  style={{ marginHorizontal: -10 }}
                  minimumValue={1}
                  maximumValue={5}
                  step={1}
                  value={fiber}
                  onValueChange={setFiber}
                  thumbSize={20}
                  minimumTrackTintColor={violet[500]}
                  maximumTrackTintColor={p.toggleOff}
                  thumbTintColor={violet[500]}
                />
              </View>
              <View style={{ flexDirection: 'row' }}>
                {FIBER_LABELS.map((l) => (
                  <Text
                    key={l}
                    style={{
                      flex: 1,
                      fontSize: 8,
                      lineHeight: 11,
                      fontFamily: font.body,
                      color: p.muted,
                      textAlign: 'center',
                    }}>
                    {l}
                  </Text>
                ))}
              </View>
            </GlassCard>
            <View>
              <Text style={smallLabel}>Jelenlegi étrendi megközelítés</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DIET_APPROACHES.map((d) => {
                  const active = dietApproach === d.id;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => setDietApproach(d.id)}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 16,
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: active ? violet[500] : p.fieldBorder,
                        backgroundColor: active
                          ? 'rgba(139,92,246,0.2)'
                          : p.fieldBg,
                      }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: font.display,
                          color: active
                            ? p.dark
                              ? violet[300]
                              : violet[700]
                            : p.muted,
                        }}>
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Fitnesz szokások */}
          <SectionHeader
            title="Fitnesz szokások és célok"
            subtitle="Segít kalibrálni a makrócélokat és edzésterveket"
          />
          <View style={{ paddingHorizontal: 20, gap: 20, paddingBottom: 16 }}>
            <GlassCard style={{ padding: 16 }}>
              <View style={styles.toggleHead}>
                <View>
                  <Text
                    style={{
                      fontFamily: font.display,
                      fontSize: 14,
                      color: p.text,
                    }}>
                    Heti edzésgyakoriság
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.body,
                      color: p.muted,
                    }}>
                    Hány alkalom hetente?
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: font.displayX,
                    fontSize: 24,
                    color: violet[400],
                    opacity: noExercise ? 0.45 : 1,
                  }}>
                  {noExercise ? 0 : frequency}
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.body,
                      color: p.muted,
                    }}>
                    {' '}
                    nap
                  </Text>
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 6,
                  marginTop: 12,
                  opacity: noExercise ? 0.45 : 1,
                }}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                  const active = !noExercise && frequency === n;
                  return (
                    <Pressable
                      key={n}
                      disabled={noExercise}
                      onPress={() => {
                        setNoExercise(false);
                        setFrequency(n);
                        updateProfile({
                          noExercise: false,
                          workoutFrequency: n,
                        });
                      }}
                      style={{ flex: 1 }}>
                      {active ? (
                        <LinearGradient
                          colors={[violet[600], violet[700]]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={styles.freqBtn}>
                          <Text
                            style={{
                              fontFamily: font.display,
                              fontSize: 14,
                              color: '#fff',
                            }}>
                            {n}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View
                          style={[
                            styles.freqBtn,
                            {
                              backgroundColor: p.fieldBgStrong,
                              borderWidth: 1,
                              borderColor: p.fieldBorder,
                            },
                          ]}>
                          <Text
                            style={{
                              fontFamily: font.display,
                              fontSize: 14,
                              color: p.muted,
                            }}>
                            {n}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() => {
                  const next = !noExercise;
                  setNoExercise(next);
                  if (next) setFocus([]);
                  updateProfile({
                    noExercise: next,
                    workoutFrequency: next ? 0 : frequency,
                    workoutFocus: next ? [] : focus,
                  });
                }}
                style={({ pressed }) => ({
                  marginTop: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1.5,
                  backgroundColor: noExercise
                    ? p.dark
                      ? 'rgba(139,92,246,0.28)'
                      : '#EDE9FE'
                    : p.fieldBgStrong,
                  borderColor: noExercise ? violet[500] : p.fieldBorder,
                  opacity: pressed ? 0.7 : 1,
                })}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: font.display,
                    color: noExercise
                      ? p.dark
                        ? violet[300]
                        : violet[700]
                      : p.muted,
                  }}>
                  {noExercise ? '✓  Nem edzek' : 'Nem edzek'}
                </Text>
              </Pressable>
            </GlassCard>

            <View style={{ opacity: noExercise ? 0.45 : 1 }}>
              <Text style={smallLabel}>
                Elsődleges fókusz{' '}
                <Text style={{ fontFamily: font.body }}>
                  (több is jelölhető)
                </Text>
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {FOCUS.map((f) => {
                  const active = !noExercise && focus.includes(f.id);
                  return (
                    <Pressable
                      key={f.id}
                      disabled={noExercise}
                      onPress={() => {
                        const next = focus.includes(f.id)
                          ? focus.filter((id) => id !== f.id)
                          : [...focus, f.id];
                        setFocus(next);
                        updateProfile({
                          workoutFocus: next,
                          noExercise: false,
                        });
                      }}
                      style={{
                        width: '31%',
                        flexGrow: 1,
                        alignItems: 'center',
                        paddingVertical: 12,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: active ? violet[500] : p.fieldBorder,
                        backgroundColor: active
                          ? 'rgba(139,92,246,0.2)'
                          : p.fieldBg,
                      }}>
                      <Text style={{ fontSize: 20, marginBottom: 4 }}>
                        {f.icon}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: font.display,
                          color: active
                            ? p.dark
                              ? violet[300]
                              : violet[700]
                            : p.text,
                        }}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

          </View>

          {/* Flóra */}
          <SectionHeader
            title="Flóra asszisztens"
            subtitle="A lebegő segítő megjelenítése a képernyőn"
          />
          <View style={{ paddingHorizontal: 20, gap: 20, paddingBottom: 16 }}>
            <GlassCard style={{ padding: 16 }}>
              <View style={styles.toggleHead}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text
                    style={{
                      fontFamily: font.display,
                      fontSize: 14,
                      color: p.text,
                    }}>
                    Lebegő Flóra
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: font.body,
                      color: p.muted,
                    }}>
                    Húzd a képernyő közepére a bezáráshoz — itt bármikor
                    visszahozhatod.
                  </Text>
                </View>
                <TogglePill
                  value={!profile.floraHidden}
                  onChange={(next) => updateProfile({ floraHidden: !next })}
                />
              </View>
            </GlassCard>

            <Pressable onPress={flushAndClose}>
              <LinearGradient
                colors={[violet[600], violet[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                }}>
                <Text
                  style={{
                    fontFamily: font.display,
                    fontSize: 16,
                    color: '#fff',
                  }}>
                  Kész
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <DocumentImportSheet
        visible={documentOpen}
        onClose={() => setDocumentOpen(false)}
      />

      <AddMedicationModal
        visible={addMedicationOpen}
        onClose={() => setAddMedicationOpen(false)}
        onAdd={(item) => {
          addMedication(item);
          updateProfile({ noPrescribedMeds: false });
        }}
      />
    </Modal>
  );
}


/** One imported document: what was read from it, and the original if kept. */
function ImportedDocumentCard({
  doc,
  onRemove,
}: {
  doc: ImportedDocument;
  onRemove: () => void;
}) {
  const p = usePalette();
  const date = doc.importedAt.slice(0, 10).replace(/-/g, '. ') + '.';

  const open = async () => {
    if (!doc.fileUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(doc.fileUri);
      }
    } catch {
      // Nothing to do: the summary below is still there to read.
    }
  };

  return (
    <GlassCard style={{ padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <FileText size={16} color={violet[400]} />
        <Text
          style={{ flex: 1, fontFamily: font.bodySemi, fontSize: 12, color: p.text }}>
          {doc.kind === 'pdf' ? 'PDF dokumentum' : 'Fotó dokumentumról'} · {date}
        </Text>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Dokumentum törlése">
          <Trash2 size={15} color={p.muted} />
        </Pressable>
      </View>

      {doc.summary ? (
        <Text
          style={{
            fontFamily: font.body,
            fontSize: 12,
            lineHeight: 18,
            color: p.muted,
          }}>
          {doc.summary}
        </Text>
      ) : null}

      {doc.appliedFields.length ? (
        <Text style={{ fontFamily: font.body, fontSize: 11, color: p.muted }}>
          Kitöltötte: {doc.appliedFields.join(', ')}
        </Text>
      ) : null}

      {doc.fileUri ? (
        <Pressable
          onPress={open}
          style={({ pressed }) => [
            {
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(167,139,250,0.5)',
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Text
            style={{ fontFamily: font.bodySemi, fontSize: 11, color: violet[400] }}>
            Eredeti megnyitása
          </Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  saveChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bigAvatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEyebrow: {
    fontSize: 10,
    fontFamily: font.display,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  toggleHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  medicationIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medicationDelete: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,113,113,0.13)',
  },
  addMedicationButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: violet[400],
    backgroundColor: violet[600],
    shadowColor: violet[500],
    shadowOpacity: 0.45,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 4 },
    elevation: 7,
  },
  addMedicationText: {
    color: '#fff',
    fontFamily: font.display,
    fontSize: 13,
  },
  freqBtn: {
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
