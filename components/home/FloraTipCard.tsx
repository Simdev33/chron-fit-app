import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';

export function FloraTipCard({
  text,
  onPress,
}: {
  text: string;
  onPress?: () => void;
}) {
  const p = usePalette();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`Flóra tippje: ${text}`}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: p.dark
            ? 'rgba(167,139,250,0.35)'
            : 'rgba(167,139,250,0.45)',
          backgroundColor: p.dark
            ? 'rgba(139,92,246,0.08)'
            : 'rgba(139,92,246,0.05)',
        },
        pressed && onPress && { opacity: 0.75 },
      ]}>
      <View style={styles.head}>
        <Sparkles size={13} color={violet[400]} />
        <Text style={[styles.eyebrow, { color: violet[400] }]}>
          Flóra tippje
        </Text>
      </View>
      <Text style={[styles.text, { color: p.text }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  eyebrow: {
    fontFamily: font.bodySemi,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  text: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
