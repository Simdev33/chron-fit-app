import { FileText, ImageIcon, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet, usePalette } from '@/components/figma/ui';
import { emerald400, font, violet } from '@/constants/figma';
import {
  deriveLabStatus,
  labStatusLabels,
  toIsoDate,
  useHealthLog,
  type LabValue,
} from '@/context/HealthLogContext';
import {
  analyzeLabReport,
  pickLabPdf,
  pickLabPhoto,
  type PickedLabFile,
} from '@/utils/analyzeLabReport';

const AMBER = '#FBBF24';
const ROSE = '#FB7185';

function statusColor(status: LabValue['status']) {
  if (status === 'normal') return emerald400;
  if (status === 'unknown') return 'rgba(255,255,255,0.4)';
  return status === 'high' ? AMBER : ROSE;
}

type Draft = LabValue & { include: boolean };

export function LabReportSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const { addLabReport } = useHealthLog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [source, setSource] = useState<'photo' | 'pdf'>('photo');

  const reset = () => {
    setBusy(false);
    setError(null);
    setDate('');
    setDrafts(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const run = async (pick: () => Promise<PickedLabFile | null>) => {
    setError(null);
    try {
      const file = await pick();
      if (!file) return;

      setSource(file.source);
      setBusy(true);
      const result = await analyzeLabReport(file);

      setDate(result.date ?? toIsoDate(new Date()));
      setDrafts(
        result.values.map((row) => ({
          ...row,
          status: deriveLabStatus(row.value, row.refLow, row.refHigh),
          include: true,
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nem sikerült beolvasni a leletet.',
      );
    } finally {
      setBusy(false);
    }
  };

  const choosePhoto = () => {
    if (Platform.OS === 'web') {
      void run(() => pickLabPhoto('library'));
      return;
    }
    Alert.alert('Lelet fotózása', 'Honnan válasszunk képet?', [
      { text: 'Kamera', onPress: () => void run(() => pickLabPhoto('camera')) },
      { text: 'Galéria', onPress: () => void run(() => pickLabPhoto('library')) },
      { text: 'Mégse', style: 'cancel' },
    ]);
  };

  const editValue = (index: number, text: string) => {
    setDrafts((current) => {
      if (!current) return current;
      const next = [...current];
      const parsed = Number(text.replace(',', '.'));
      const value = Number.isFinite(parsed) ? parsed : next[index].value;
      next[index] = {
        ...next[index],
        value,
        status: deriveLabStatus(value, next[index].refLow, next[index].refHigh),
      };
      return next;
    });
  };

  const toggleRow = (index: number) => {
    setDrafts((current) => {
      if (!current) return current;
      const next = [...current];
      next[index] = { ...next[index], include: !next[index].include };
      return next;
    });
  };

  const kept = drafts?.filter((row) => row.include) ?? [];

  const save = () => {
    if (kept.length === 0) return;
    addLabReport({
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toIsoDate(new Date()),
      source,
      values: kept.map(({ include: _include, ...value }) => value),
    });
    close();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title="Új lelet">
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled">
        {!drafts ? (
          <>
            <Text
              style={{
                fontSize: 13,
                fontFamily: font.body,
                color: p.muted,
                lineHeight: 19,
              }}>
              Fotózd le a leletet, vagy válaszd ki a kapott PDF-et. Kiolvasom
              belőle az értékeket, te pedig ellenőrizheted őket mentés előtt.
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
                Fotó a leletről
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void run(pickLabPdf)}
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

            {busy ? (
              <View style={{ alignItems: 'center', gap: 10, paddingTop: 8 }}>
                <ActivityIndicator color={violet[400]} />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: font.bodyMedium,
                    color: p.muted,
                  }}>
                  Kiolvasom az értékeket…
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(251, 191, 36, 0.4)',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
              }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: font.body,
                  color: p.dark ? '#FDE68A' : '#92400E',
                  lineHeight: 18,
                }}>
                Nézd át az értékeket mentés előtt. A gépi kiolvasás hibázhat,
                és ezek az adatok a te egészségnaplódba kerülnek.
              </Text>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: p.text }]}>
                Mintavétel dátuma
              </Text>
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="ÉÉÉÉ-HH-NN"
                placeholderTextColor={p.muted}
                style={[
                  styles.input,
                  {
                    color: p.text,
                    borderColor: p.dark ? 'rgba(255,255,255,0.12)' : '#E9D5FF',
                  },
                ]}
              />
            </View>

            {drafts.map((row, index) => (
              <View
                key={`${row.name}-${index}`}
                style={[
                  styles.row,
                  {
                    borderColor: p.dark ? 'rgba(255,255,255,0.1)' : '#F3E8FF',
                    opacity: row.include ? 1 : 0.4,
                  },
                ]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: font.bodySemi,
                      fontSize: 13,
                      color: p.text,
                    }}>
                    {row.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: font.body,
                      fontSize: 11,
                      color: p.muted,
                    }}>
                    {row.refRange
                      ? `Referencia: ${row.refRange}`
                      : 'A leleten nem volt referencia'}
                  </Text>
                  <Text
                    style={{
                      fontFamily: font.bodySemi,
                      fontSize: 11,
                      color: statusColor(row.status),
                    }}>
                    {labStatusLabels[row.status]}
                  </Text>
                </View>

                <TextInput
                  defaultValue={String(row.value)}
                  onChangeText={(text) => editValue(index, text)}
                  keyboardType="decimal-pad"
                  editable={row.include}
                  style={[
                    styles.valueInput,
                    {
                      color: p.text,
                      borderColor: p.dark
                        ? 'rgba(255,255,255,0.12)'
                        : '#E9D5FF',
                    },
                  ]}
                />
                <Text
                  style={{
                    fontFamily: font.body,
                    fontSize: 11,
                    color: p.muted,
                    width: 46,
                  }}>
                  {row.unit}
                </Text>

                <Pressable
                  onPress={() => toggleRow(index)}
                  hitSlop={8}
                  accessibilityLabel={`${row.name} elhagyása`}>
                  <Trash2 size={16} color={p.muted} />
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={save}
              disabled={kept.length === 0}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor:
                    kept.length === 0 ? 'rgba(124,58,237,0.4)' : violet[600],
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <Text style={styles.saveLabel}>
                {kept.length === 0
                  ? 'Nincs mentendő érték'
                  : `Mentés (${kept.length} érték)`}
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
  fieldLabel: { fontFamily: font.bodySemi, fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  valueInput: {
    width: 74,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: 'right',
    fontFamily: font.bodySemi,
    fontSize: 14,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveLabel: { fontFamily: font.display, fontSize: 15, color: '#FFFFFF' },
});
