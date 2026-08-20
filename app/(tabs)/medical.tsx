import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight,
  FileDown,
  FlaskConical,
  Plus,
  User,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
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

import { BackgroundWrapper } from '@/components/BackgroundWrapper';
import { DualLineChart } from '@/components/figma/DualLineChart';
import { HealthCalendar } from '@/components/figma/HealthCalendar';
import { LabReportSheet } from '@/components/figma/LabReportSheet';
import { ProfileModal } from '@/components/figma/ProfileModal';
import { GlassCard, usePalette } from '@/components/figma/ui';
import { emerald400, font, fuchsia400, violet } from '@/constants/figma';
import {
  labStatusLabels,
  useHealthLog,
  type LabStatus,
} from '@/context/HealthLogContext';
import { useProfile } from '@/context/ProfileContext';
import { useTabBarSpacing } from '@/context/TabBarContext';
import {
  exportHealthReport,
  type ExportMode,
} from '@/utils/exportHealthReport';

const AMBER = '#FBBF24';
const ROSE = '#FB7185';

function statusStyle(status: LabStatus) {
  if (status === 'normal') {
    return { color: emerald400, background: 'rgba(52,211,153,0.15)' };
  }
  if (status === 'unknown') {
    return {
      color: 'rgba(255,255,255,0.5)',
      background: 'rgba(255,255,255,0.08)',
    };
  }
  return status === 'high'
    ? { color: AMBER, background: 'rgba(251,191,36,0.15)' }
    : { color: ROSE, background: 'rgba(251,113,133,0.15)' };
}

function formatValue(value: number) {
  return String(value).replace('.', ',');
}

const CRP_NAME = /^crp/i;
const MONTHS = [
  'jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.',
  'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.',
];

function shortDate(iso: string) {
  const [, month, day] = iso.split('-');
  const index = Number(month) - 1;
  return `${MONTHS[index] ?? month} ${Number(day)}.`;
}

export default function MedicalScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const tabBarSpacing = useTabBarSpacing();
  const [profileOpen, setProfileOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [labSheetOpen, setLabSheetOpen] = useState(false);
  const { profile } = useProfile();
  const { log } = useHealthLog();
  // The newest report is the one worth showing; the list is kept sorted.
  const latestLabs = log.labReports[0]?.values ?? [];

  // The two series run on different clocks: symptoms are daily, labs occasional.
  // The lab dates drive the x-axis, and each point borrows that day's pain score.
  const chartData = useMemo(() => {
    return [...log.labReports]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((report) => {
        const crp = report.values.find((v) => CRP_NAME.test(v.name));
        if (!crp) return null;
        const daySymptoms = log.symptoms[report.date] ?? [];
        const severity = daySymptoms.length
          ? daySymptoms.reduce((sum, e) => sum + e.pain, 0) / daySymptoms.length
          : 0;
        return {
          date: shortDate(report.date),
          severity: Math.round(severity * 10) / 10,
          crp: crp.value,
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null);
  }, [log.labReports, log.symptoms]);

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
    <BackgroundWrapper variant="health">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: tabBarSpacing,
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
            {chartData.length >= 2 ? (
              <DualLineChart data={chartData} />
            ) : (
              <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: font.body,
                    fontSize: 12,
                    color: p.muted,
                    textAlign: 'center',
                    lineHeight: 18,
                  }}>
                  Legalább két CRP-eredmény kell ahhoz, hogy trendet
                  rajzolhassak. Olvass be egy leletet lentebb.
                </Text>
              </View>
            )}
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              // The label's own marginBottom would sit inside this row and
              // push the button down onto the card; the gap belongs here.
              marginBottom: 12,
            }}>
            <Text
              style={[styles.sectionLabel, { color: p.muted, marginBottom: 0 }]}>
              Legutóbbi laboreredmények
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Új lelet hozzáadása"
              onPress={() => setLabSheetOpen(true)}
              style={({ pressed }) => [
                styles.newLabBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}>
              <Plus size={14} color="#FFFFFF" />
              <Text style={styles.newLabLabel}>Új lelet</Text>
            </Pressable>
          </View>

          {latestLabs.length === 0 ? (
            <GlassCard style={{ padding: 20, alignItems: 'center', gap: 8 }}>
              <FlaskConical size={26} color={violet[400]} />
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 14,
                  color: p.text,
                  textAlign: 'center',
                }}>
                Még nincs beolvasott leleted
              </Text>
              <Text
                style={{
                  fontFamily: font.body,
                  fontSize: 12,
                  color: p.muted,
                  textAlign: 'center',
                  lineHeight: 18,
                }}>
                Fotózd le a papír leletet vagy válaszd ki a PDF-et, és kiolvasom
                belőle az értékeket.
              </Text>
            </GlassCard>
          ) : null}

          <View style={{ gap: 12 }}>
            {latestLabs.map((l) => (
              <GlassCard key={`${l.name}-${l.unit}`} style={{ padding: 16 }}>
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
                    <FlaskConical size={18} color={violet[400]} />
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
                      {formatValue(l.value)} {l.unit}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: statusStyle(l.status).background,
                    }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: font.bodySemi,
                        color: statusStyle(l.status).color,
                      }}>
                      {labStatusLabels[l.status]}
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

      <LabReportSheet
        visible={labSheetOpen}
        onClose={() => setLabSheetOpen(false)}
      />

      {profileOpen ? (
        <ProfileModal
          visible
          onClose={() => setProfileOpen(false)}
        />
      ) : null}
    </BackgroundWrapper>
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
  newLabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: violet[600],
  },
  newLabLabel: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    color: '#FFFFFF',
  },
  legendLabel: {
    fontSize: 11,
    fontFamily: font.bodyMedium,
  },
});
