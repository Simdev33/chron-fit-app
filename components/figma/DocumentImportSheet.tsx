import { Check, FileText, ImageIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet, usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import { diagnosisLabels, useProfile } from '@/context/ProfileContext';
import {
  analyzeDocument,
  type DocumentFindings,
} from '@/utils/analyzeDocument';
import {
  pickMedicalPdf,
  pickMedicalPhoto,
  type PickedMedicalFile,
} from '@/utils/pickMedicalFile';

/** One reviewable line of the import. */
type Row = {
  key: string;
  label: string;
  value: string;
  apply: boolean;
};

function buildRows(f: DocumentFindings): Row[] {
  const rows: Row[] = [];
  if (f.diagnosis) {
    rows.push({
      key: 'diagnosis',
      label: 'Diagnózis',
      value: diagnosisLabels[f.diagnosis],
      apply: true,
    });
  }
  if (f.resectedSegments.length) {
    rows.push({
      key: 'resectedSegments',
      label: 'Érintett bélszakaszok',
      value: f.resectedSegments.join(', '),
      apply: true,
    });
  }
  if (f.hasStoma !== null) {
    rows.push({
      key: 'stoma',
      label: 'Sztóma',
      value: f.hasStoma ? (f.stomaType ?? 'Van') : 'Nincs',
      apply: true,
    });
  }
  if (f.hadSurgery !== null) {
    rows.push({
      key: 'surgery',
      label: 'Műtétek',
      value: f.hadSurgery ? (f.surgeryNotes || 'Volt műtét') : 'Nem volt',
      apply: true,
    });
  }
  if (f.jointSymptoms !== null) {
    rows.push({
      key: 'joints',
      label: 'Ízületi panaszok',
      value: f.jointSymptoms ? 'Igen' : 'Nem',
      apply: true,
    });
  }
  if (f.skinSymptoms !== null) {
    rows.push({
      key: 'skin',
      label: 'Bőrtünetek',
      value: f.skinSymptoms ? 'Igen' : 'Nem',
      apply: true,
    });
  }
  if (f.medications.length) {
    rows.push({
      key: 'medications',
      label: 'Említett gyógyszerek',
      value: f.medications
        .map((m) => (m.note ? `${m.name} (${m.note})` : m.name))
        .join(', '),
      apply: false,
    });
  }
  return rows;
}

export function DocumentImportSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const { updateProfile } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<DocumentFindings | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const close = () => {
    setBusy(false);
    setError(null);
    setFindings(null);
    setRows([]);
    onClose();
  };

  const run = async (pick: () => Promise<PickedMedicalFile | null>) => {
    setError(null);
    try {
      const file = await pick();
      if (!file) return;

      setBusy(true);
      const result = await analyzeDocument(file);
      setFindings(result);
      setRows(buildRows(result));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nem sikerült feldolgozni a dokumentumot.',
      );
    } finally {
      setBusy(false);
    }
  };

  const choosePhoto = () => {
    if (Platform.OS === 'web') {
      void run(() => pickMedicalPhoto('library'));
      return;
    }
    Alert.alert('Dokumentum fotózása', 'Honnan válasszunk képet?', [
      {
        text: 'Kamera',
        onPress: () => void run(() => pickMedicalPhoto('camera')),
      },
      {
        text: 'Galéria',
        onPress: () => void run(() => pickMedicalPhoto('library')),
      },
      { text: 'Mégse', style: 'cancel' },
    ]);
  };

  const toggle = (key: string) =>
    setRows((current) =>
      current.map((row) =>
        row.key === key ? { ...row, apply: !row.apply } : row,
      ),
    );

  const applied = rows.filter((row) => row.apply);

  const save = () => {
    if (!findings) return;
    const keys = new Set(applied.map((row) => row.key));
    const patch: Parameters<typeof updateProfile>[0] = {};

    if (keys.has('diagnosis') && findings.diagnosis) {
      patch.diagnosis = findings.diagnosis;
    }
    if (keys.has('resectedSegments')) {
      patch.resectedSegments = findings.resectedSegments;
    }
    if (keys.has('stoma')) {
      patch.hasStoma = findings.hasStoma ?? false;
      patch.stomaType = findings.hasStoma ? (findings.stomaType ?? '') : '';
    }
    if (keys.has('surgery')) {
      patch.hadSurgery = findings.hadSurgery ?? false;
      patch.surgeryNotes = findings.hadSurgery ? findings.surgeryNotes : '';
    }
    if (keys.has('joints')) patch.jointSymptoms = findings.jointSymptoms ?? false;
    if (keys.has('skin')) patch.skinSymptoms = findings.skinSymptoms ?? false;
    // The medications row is informational: the organiser needs a dose and a
    // schedule per entry, which a document rarely spells out in full.
    if (findings.summary) patch.documentSummary = findings.summary;

    updateProfile(patch);
    close();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title="Dokumentum feltöltése">
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled">
        {!findings ? (
          <>
            <Text style={[styles.intro, { color: p.muted }]}>
              Töltsd fel a zárójelentésedet vagy ambuláns lapodat, és kitöltöm
              belőle amit tudok: diagnózis, műtétek, érintett bélszakaszok.
              Mentés előtt mindent átnézhetsz.
            </Text>

            <Pressable
              onPress={choosePhoto}
              disabled={busy}
              style={({ pressed }) => [
                styles.sourceBtn,
                {
                  borderColor: p.dark ? 'rgba(255,255,255,0.15)' : '#E9D5FF',
                  opacity: pressed && !busy ? 0.75 : 1,
                },
              ]}>
              <ImageIcon size={22} color={violet[400]} />
              <Text style={[styles.sourceLabel, { color: p.text }]}>
                Fotó a dokumentumról
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void run(pickMedicalPdf)}
              disabled={busy}
              style={({ pressed }) => [
                styles.sourceBtn,
                {
                  borderColor: p.dark ? 'rgba(255,255,255,0.15)' : '#E9D5FF',
                  opacity: pressed && !busy ? 0.75 : 1,
                },
              ]}>
              <FileText size={22} color={violet[400]} />
              <Text style={[styles.sourceLabel, { color: p.text }]}>
                PDF kiválasztása
              </Text>
            </Pressable>

            <Text style={[styles.privacy, { color: p.muted }]}>
              A dokumentum feldolgozásra elküldjük, de nem tároljuk: csak a
              belőle kiolvasott adatok kerülnek a telefonodra.
            </Text>

            {busy ? (
              <View style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
                <ActivityIndicator color={violet[400]} />
                <Text style={[styles.sourceLabel, { color: p.muted }]}>
                  Elolvasom a dokumentumot…
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.warning}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: font.body,
                  color: p.dark ? '#FDE68A' : '#92400E',
                  lineHeight: 18,
                }}>
                Nézd át, mit értettem meg. Csak a bepipált sorok kerülnek a
                profilodba.
              </Text>
            </View>

            {findings.summary ? (
              <Text style={[styles.summary, { color: p.text }]}>
                {findings.summary}
              </Text>
            ) : null}

            {rows.map((row) => (
              <Pressable
                key={row.key}
                onPress={() => toggle(row.key)}
                style={[
                  styles.row,
                  {
                    borderColor: row.apply
                      ? 'rgba(167,139,250,0.5)'
                      : p.dark
                        ? 'rgba(255,255,255,0.1)'
                        : '#F3E8FF',
                    opacity: row.apply ? 1 : 0.5,
                  },
                ]}>
                <View
                  style={[
                    styles.check,
                    {
                      backgroundColor: row.apply
                        ? violet[600]
                        : 'transparent',
                      borderColor: row.apply
                        ? violet[600]
                        : p.dark
                          ? 'rgba(255,255,255,0.25)'
                          : '#DDD6FE',
                    },
                  ]}>
                  {row.apply ? <Check size={12} color="#FFFFFF" /> : null}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.rowLabel, { color: p.muted }]}>
                    {row.label}
                  </Text>
                  <Text style={[styles.rowValue, { color: p.text }]}>
                    {row.value}
                  </Text>
                </View>
              </Pressable>
            ))}

            <Pressable
              onPress={save}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: violet[600], opacity: pressed ? 0.85 : 1 },
              ]}>
              <Text style={styles.saveLabel}>
                {applied.length === 0
                  ? 'Mentés összefoglalóval'
                  : `Mentés (${applied.length} adat)`}
              </Text>
            </Pressable>
          </>
        )}

        {error ? (
          <Text
            style={{ fontSize: 12, fontFamily: font.body, color: '#FCA5A5' }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, fontFamily: font.body, lineHeight: 19 },
  privacy: { fontSize: 11, fontFamily: font.body, lineHeight: 16 },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  sourceLabel: { fontFamily: font.bodySemi, fontSize: 14 },
  warning: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  summary: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowLabel: { fontFamily: font.bodySemi, fontSize: 11 },
  rowValue: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  saveBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveLabel: { fontFamily: font.display, fontSize: 15, color: '#FFFFFF' },
});
