import { LinearGradient } from 'expo-linear-gradient';
import {
  Activity,
  ChevronRight,
  Droplets,
  FileDown,
  FlaskConical,
  Flame,
  User,
} from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DualLineChart } from '@/components/figma/DualLineChart';
import { HealthCalendar } from '@/components/figma/HealthCalendar';
import { ProfileModal } from '@/components/figma/ProfileModal';
import { GlassCard, usePalette } from '@/components/figma/ui';
import { emerald400, font, fuchsia400, violet } from '@/constants/figma';
import { CHART_DATA } from '@/constants/figmaData';
import { useHealthLog } from '@/context/HealthLogContext';
import { useProfile } from '@/context/ProfileContext';
import {
  exportHealthReport,
  type ExportMode,
} from '@/utils/exportHealthReport';

const LABS = [
  {
    name: 'CRP',
    value: '1,8 mg/L',
    status: 'Normál',
    ok: true,
    Icon: Droplets,
  },
  {
    name: 'Kalprotektin',
    value: '112 µg/g',
    status: 'Enyhén emelkedett',
    ok: false,
    Icon: FlaskConical,
  },
  {
    name: 'Hemoglobin',
    value: '13,9 g/dL',
    status: 'Normál',
    ok: true,
    Icon: Activity,
  },
  {
    name: 'B12-vitamin',
    value: '480 pg/mL',
    status: 'Normál',
    ok: true,
    Icon: Flame,
  },
];

export default function MedicalScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [profileOpen, setProfileOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { profile } = useProfile();
  const { log } = useHealthLog();

  const runExport = async (mode: ExportMode) => {
    setExporting(true);
    try {
      const result = await exportHealthReport(profile, log, mode);
      if (mode === 'save' && result === 'done') {
        Alert.alert(
          'Sikeres mentés',
          'A riport PDF-ként elmentve a kiválasztott mappába.',
        );
      }
    } catch (err) {
      console.error('PDF export hiba:', err);
      Alert.alert(
        'Sikertelen exportálás',
        `A PDF elkészítése nem sikerült.\n\nRészletek: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      setExporting(false);
    }
  };

  const onExport = () => {
    if (exporting) return;
    if (Platform.OS === 'android') {
      Alert.alert('Riport exportálása', 'Mit szeretnél tenni a PDF-fel?', [
        { text: 'Mentés a telefonra', onPress: () => runExport('save') },
        { text: 'Megosztás', onPress: () => runExport('share') },
        { text: 'Mégse', style: 'cancel' },
      ]);
    } else {
      // Weben nyomtatási ablak nyílik, iOS-en a megosztási panelről a
      // "Mentés a Fájlok appba" opcióval menthető helyben is.
      runExport('share');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 140,
        }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: font.displayX, fontSize: 24, color: p.text }}>
              Egészségügyi áttekintés
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontFamily: font.body,
                color: p.muted,
                marginTop: 2,
              }}>
              Tünetek, laborok és trendek egy helyen.
            </Text>
          </View>
          <Pressable
            onPress={onExport}
            accessibilityLabel="Tünetek exportálása PDF-be"
            style={({ pressed }) => [
              styles.exportBtn,
              pressed && { transform: [{ scale: 0.93 }] },
            ]}>
            <LinearGradient
              colors={[violet[600], violet[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.exportInner}>
              {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FileDown size={18} color="#fff" />
              )}
              <Text style={styles.exportLabel}>Exportálás</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Napi napló naptár */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={[styles.sectionLabel, { color: p.muted }]}>
            Napi napló
          </Text>
          <HealthCalendar />
        </View>

        {/* Stat kártyák */}
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            paddingHorizontal: 20,
            marginBottom: 20,
          }}>
          <GlassCard style={{ flex: 1, padding: 16 }}>
            <Text style={[styles.statValue, { color: p.text }]}>28</Text>
            <Text style={[styles.statLabel, { color: p.muted }]}>
              nap tünetmentesen
            </Text>
          </GlassCard>
          <GlassCard style={{ flex: 1, padding: 16 }}>
            <Text style={[styles.statValue, { color: p.text }]}>96%</Text>
            <Text style={[styles.statLabel, { color: p.muted }]}>
              gyógyszer-adherencia
            </Text>
          </GlassCard>
          <GlassCard style={{ flex: 1, padding: 16 }}>
            <Text style={[styles.statValue, { color: p.text }]}>1,8</Text>
            <Text style={[styles.statLabel, { color: p.muted }]}>
              CRP (mg/L)
            </Text>
          </GlassCard>
        </View>

        {/* Duál grafikon */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <GlassCard style={{ padding: 20 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: font.bodySemi,
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  color: p.muted,
                }}>
                Tünetek és CRP – 30 nap
              </Text>
            </View>
            <DualLineChart data={CHART_DATA} />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: violet[500] }]}
                />
                <Text style={[styles.legendLabel, { color: p.muted }]}>
                  Tünet-súlyosság
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: fuchsia400 }]}
                />
                <Text style={[styles.legendLabel, { color: p.muted }]}>
                  CRP (mg/L)
                </Text>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* Laboreredmények */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={[styles.sectionLabel, { color: p.muted }]}>
            Legutóbbi laboreredmények
          </Text>
          <View style={{ gap: 12 }}>
            {LABS.map((l) => (
              <GlassCard key={l.name} style={{ padding: 16 }}>
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
                      backgroundColor: 'rgba(139,92,246,0.2)',
                    }}>
                    <l.Icon size={18} color={violet[400]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: font.display,
                        fontSize: 14,
                        color: p.text,
                      }}>
                      {l.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.body,
                        color: p.muted,
                      }}>
                      {l.value}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: l.ok
                        ? 'rgba(52,211,153,0.15)'
                        : 'rgba(251,191,36,0.15)',
                    }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: font.bodySemi,
                        color: l.ok ? emerald400 : '#FBBF24',
                      }}>
                      {l.status}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        </View>

        {/* Profil kártya */}
        <View style={{ paddingHorizontal: 20 }}>
          <Pressable
            onPress={() => setProfileOpen(true)}
            style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
            <LinearGradient
              colors={['rgba(124,58,237,0.55)', 'rgba(109,40,217,0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(167,139,250,0.25)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                }}>
                <User size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: font.display,
                    fontSize: 16,
                    color: '#fff',
                  }}>
                  Egészségügyi profilom
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: font.body,
                    color: 'rgba(255,255,255,0.6)',
                  }}>
                  Diagnózis, gyógyszerek, étrend és fitnesz beállítások
                </Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>

      <ProfileModal
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  exportBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  exportInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  exportLabel: {
    fontFamily: font.display,
    fontSize: 13,
    color: '#fff',
  },
  statValue: {
    fontFamily: font.displayX,
    fontSize: 22,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: font.bodyMedium,
    lineHeight: 13,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendLabel: {
    fontSize: 11,
    fontFamily: font.bodyMedium,
  },
});
