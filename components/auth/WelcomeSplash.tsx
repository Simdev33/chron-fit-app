import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { VitalityTree } from '@/components/figma/VitalityTree';
import { usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';

export function WelcomeSplash({ onDone }: { onDone: () => void }) {
  const p = usePalette();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.3,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      );
    const anims = [pulse(dot1, 0), pulse(dot2, 200), pulse(dot3, 400)];
    anims.forEach((a) => a.start());

    const timer = setTimeout(onDone, 2400);
    return () => {
      anims.forEach((a) => a.stop());
      clearTimeout(timer);
    };
  }, [fade, scale, dot1, dot2, dot3, onDone]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.bg }]}>
      <VitalityTree remission />
      <Animated.View
        style={[
          styles.center,
          { opacity: fade, transform: [{ scale }] },
        ]}>
        <LinearGradient
          colors={[violet[400], violet[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logo}>
          <Sparkles size={40} color="#fff" />
        </LinearGradient>
        <Text style={[styles.title, { color: p.text }]}>CrohnFit</Text>
        <Text style={[styles.subtitle, { color: p.muted }]}>
          A társad az IBD mindennapjaiban
        </Text>
        <View style={styles.dots}>
          {[dot1, dot2, dot3].map((v, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: violet[400], opacity: v },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  title: {
    fontFamily: font.displayX,
    fontSize: 36,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: font.body,
    fontSize: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
});
