import { Check, Package, Pill, Plus, Syringe } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { font, violet } from '@/constants/figma';
import {
  medicationDoseKey,
  useHealthLog,
  type MedicationEntry,
  isMedicationDueOn,
} from '@/context/HealthLogContext';
import { useAppTheme } from '@/context/ThemeContext';
import { triggerFloraSpeech } from '@/utils/floraSpeech';
import { AddMedicationModal } from './AddMedicationModal';

type TimelineMedication = MedicationEntry & {
  time: string;
  taken: boolean;
};

function TimelineCard({
  item,
  onTake,
}: {
  item: TimelineMedication;
  onTake: (id: string, time: string) => void;
}) {
  const { isDark } = useAppTheme();
  const progress = useSharedValue(item.taken ? 1 : 0);

  React.useEffect(() => {
    progress.value = withSpring(item.taken ? 1 : 0, {
      damping: 15,
      stiffness: 220,
      mass: 0.55,
    });
  }, [item.taken, progress]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0.66]),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [
        isDark ? 'rgba(196,181,253,0.18)' : 'rgba(124,58,237,0.16)',
        'rgba(52,211,153,0.72)',
      ],
    ),
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [1, 0.985]),
      },
    ],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.35, 1]) },
      { rotate: `${interpolate(progress.value, [0, 1], [-18, 0])}deg` },
    ],
  }));

  // A nulla küszöb azt jelenti, hogy ennél a szernél nem követünk készletet,
  // különben minden ilyen bejegyzés örökre "fogytán" állapotban állna.
  const tracksInventory = item.refillThreshold > 0;
  const lowStock = tracksInventory && item.inventoryRemaining <= item.refillThreshold;
  const ItemIcon =
    item.type === 'pill'
      ? Pill
      : item.type === 'biologic'
        ? Syringe
        : Package;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.075)'
            : 'rgba(255,255,255,0.88)',
        },
        cardStyle,
      ]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor:
              item.type === 'pill'
                ? 'rgba(139,92,246,0.2)'
                : item.type === 'biologic'
                  ? 'rgba(217,70,239,0.2)'
                : 'rgba(99,102,241,0.2)',
          },
        ]}>
        <ItemIcon size={20} color={violet[400]} strokeWidth={2} />
      </View>

      <View style={styles.cardCopy}>
        <Text
          style={[
            styles.itemName,
            { color: isDark ? '#fff' : '#1A0D35' },
            item.taken && styles.takenText,
          ]}>
          {item.name}
        </Text>
        <Text
          style={[
            styles.dose,
            {
              color: isDark
                ? 'rgba(255,255,255,0.52)'
                : 'rgba(76,29,149,0.65)',
            },
          ]}>
          {item.dose}
        </Text>
        <Text
          style={[
            styles.inventory,
            {
              color: lowStock
                ? '#FCA5A5'
                : isDark
                  ? 'rgba(255,255,255,0.34)'
                  : 'rgba(76,29,149,0.45)',
            },
          ]}>
          {item.inventoryRemaining} adag készleten
        </Text>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${item.name} bevételének jelölése`}
        accessibilityState={{ checked: item.taken, disabled: item.taken }}
        disabled={item.taken}
        hitSlop={8}
        onPress={() => onTake(item.id, item.time)}
        style={({ pressed }) => [
          styles.checkbox,
          item.taken ? styles.checkboxTaken : styles.checkboxPending,
          pressed && !item.taken && { transform: [{ scale: 0.9 }] },
        ]}>
        <Animated.View style={checkStyle}>
          <Check size={21} color="#fff" strokeWidth={3} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export function MedicationTimeline() {
  const { isDark } = useAppTheme();
  const { log, addMedication, takeMedicationDose } = useHealthLog();
  const [addOpen, setAddOpen] = useState(false);
  const refillAlerted = useRef(new Set<string>());

  const takenToday = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return new Set(log.takenDoses?.[`${year}-${month}-${day}`] ?? []);
  }, [log.takenDoses]);

  const meds = useMemo<TimelineMedication[]>(
    () =>
      log.medications
        .filter((medication) => isMedicationDueOn(medication, new Date()))
        .flatMap((medication) =>
        medication.times.map((time) => ({
          ...medication,
          time,
          taken: takenToday.has(medicationDoseKey(medication.id, time)),
        })),
      ),
    [log.medications, takenToday],
  );

  const groupedMeds = useMemo(() => {
    const groups = new Map<string, TimelineMedication[]>();
    meds.forEach((item) => {
      groups.set(item.time, [...(groups.get(item.time) ?? []), item]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [meds]);

  const handleTakeDose = useCallback(
    (id: string, time: string) => {
      const item = meds.find((med) => med.id === id && med.time === time);
      if (!item || item.taken) return;

      const newInventory = Math.max(0, item.inventoryRemaining - 1);
      takeMedicationDose(id, time);

      if (
        item.refillThreshold > 0 &&
        newInventory <= item.refillThreshold &&
        !refillAlerted.current.has(item.id)
      ) {
        refillAlerted.current.add(item.id);
        triggerFloraSpeech(
          `Figyelem! A(z) ${item.name} készleted hamarosan elfogy (${newInventory} adag maradt). Ideje újrarendelni!`,
        );
      }
    },
    [meds, takeMedicationDose],
  );

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text
          style={[
            styles.progressText,
            {
              color: isDark
                ? 'rgba(255,255,255,0.48)'
                : 'rgba(76,29,149,0.58)',
            },
          ]}>
          {meds.length > 0
            ? `${meds.filter((item) => item.taken).length}/${meds.length} kész`
            : 'Nincs mai adag'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Új gyógyszer vagy kiegészítő"
          onPress={() => setAddOpen(true)}
          style={({ pressed }) => [
            styles.addButton,
            pressed && { transform: [{ scale: 0.95 }] },
          ]}>
          <Plus size={15} color="#fff" strokeWidth={2.6} />
          <Text style={styles.addButtonText}>Új hozzáadása</Text>
        </Pressable>
      </View>

      <View style={styles.timelineBody}>
        {meds.length > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.timelineLine,
              {
                backgroundColor: isDark
                  ? 'rgba(167,139,250,0.28)'
                  : 'rgba(124,58,237,0.22)',
              },
            ]}
          />
        ) : null}

        {groupedMeds.map(([time, items]) => (
          <View key={time} style={styles.group}>
            <View style={styles.rail}>
              <View style={styles.dotGlow} />
              <View style={styles.dot} />
            </View>

            <View style={styles.groupContent}>
              <Text
                style={[
                  styles.time,
                  {
                    color: isDark
                      ? 'rgba(216,180,254,0.92)'
                      : violet[700],
                  },
                ]}>
                {time}
              </Text>
              <View style={styles.cards}>
                {items.map((item) => (
                  <TimelineCard
                    key={item.id}
                    item={item}
                    onTake={handleTakeDose}
                  />
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>

      <AddMedicationModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addMedication}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  progressText: {
    fontFamily: font.bodySemi,
    fontSize: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: violet[400],
    backgroundColor: violet[600],
    shadowColor: violet[500],
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  addButtonText: {
    color: '#fff',
    fontFamily: font.display,
    fontSize: 11,
  },
  timelineBody: {
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    top: 13,
    bottom: 16,
    left: 18,
    width: 2,
    borderRadius: 999,
  },
  group: {
    flexDirection: 'row',
    minHeight: 82,
    paddingBottom: 18,
  },
  rail: {
    width: 38,
    alignItems: 'center',
    paddingTop: 4,
  },
  dotGlow: {
    position: 'absolute',
    top: 3,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#D8B4FE',
    backgroundColor: violet[600],
    shadowColor: violet[400],
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },
  groupContent: {
    flex: 1,
    minWidth: 0,
  },
  time: {
    fontFamily: font.displayX,
    fontSize: 13,
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  cards: {
    gap: 9,
  },
  card: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontFamily: font.display,
    fontSize: 14,
  },
  takenText: {
    textDecorationLine: 'line-through',
  },
  dose: {
    fontFamily: font.bodyMedium,
    fontSize: 12,
    marginTop: 2,
  },
  inventory: {
    fontFamily: font.body,
    fontSize: 10,
    marginTop: 4,
  },
  checkbox: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  checkboxPending: {
    borderColor: 'rgba(196,181,253,0.52)',
    backgroundColor: 'rgba(139,92,246,0.08)',
  },
  checkboxTaken: {
    borderColor: '#6EE7B7',
    backgroundColor: '#10B981',
    shadowColor: '#34D399',
    shadowOpacity: 0.75,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
