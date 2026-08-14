import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';
import {
  TUTORIAL_STEPS,
  useTutorial,
  type TargetRect,
} from '@/context/TutorialContext';

const HOLE_PADDING = 10;
const HOLE_RADIUS = 20;
const BACKDROP = 'rgba(3,2,8,0.78)';

export function TutorialOverlay() {
  const p = usePalette();
  const { active, stepIndex, next, skip, measureTarget } = useTutorial();
  const { width, height } = useWindowDimensions();
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [measured, setMeasured] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const step = TUTORIAL_STEPS[stepIndex];
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  // Célpont bemérése (pár próbálkozással, amíg a nézet fel nem épül).
  useEffect(() => {
    if (!active || !step) return;
    let cancelled = false;
    setMeasured(false);
    setRect(null);
    if (!step.target) {
      setMeasured(true);
      return;
    }
    let attempts = 0;
    const tryMeasure = async () => {
      const r = await measureTarget(step.target!);
      if (cancelled) return;
      if (r) {
        setRect(r);
        setMeasured(true);
      } else if (attempts < 8) {
        attempts += 1;
        setTimeout(tryMeasure, 200);
      } else {
        setMeasured(true); // nem található célpont → középre igazított kártya
      }
    };
    tryMeasure();
    return () => {
      cancelled = true;
    };
  }, [active, step, measureTarget]);

  useEffect(() => {
    if (active && measured) {
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    }
  }, [active, measured, stepIndex, fade]);

  if (!active || !step || !measured) return null;

  const hole = rect
    ? {
        x: Math.max(rect.x - HOLE_PADDING, 4),
        y: Math.max(rect.y - HOLE_PADDING, 4),
        w: Math.min(rect.width + HOLE_PADDING * 2, width - 8),
        h: rect.height + HOLE_PADDING * 2,
      }
    : null;

  // A kártya a kiemelt rész alá kerül, ha az a képernyő felső felén van,
  // egyébként fölé.
  const cardBelow = hole ? hole.y + hole.h / 2 < height * 0.5 : false;
  const cardPosition = hole
    ? cardBelow
      ? { top: Math.min(hole.y + hole.h + 16, height - 260) }
      : { bottom: Math.max(height - hole.y + 16, 120) }
    : { top: height / 2 - 140 };

  return (
    <View style={styles.root} pointerEvents="auto">
      {/* Sötétített háttér, lyukkal a célpont körül */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="hole-mask">
            <Rect x={0} y={0} width={width} height={height} fill="#fff" />
            {hole && (
              <Rect
                x={hole.x}
                y={hole.y}
                width={hole.w}
                height={hole.h}
                rx={HOLE_RADIUS}
                fill="#000"
              />
            )}
          </Mask>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={BACKDROP}
          mask="url(#hole-mask)"
        />
        {hole && (
          <Rect
            x={hole.x}
            y={hole.y}
            width={hole.w}
            height={hole.h}
            rx={HOLE_RADIUS}
            fill="none"
            stroke={violet[400]}
            strokeWidth={2}
          />
        )}
      </Svg>

      {/* Koppintás bárhol → következő lépés */}
      <Pressable style={StyleSheet.absoluteFill} onPress={next} />

      <Animated.View
        style={[
          styles.card,
          cardPosition,
          {
            backgroundColor: p.dark ? '#150F2E' : '#FFFFFF',
            borderColor: p.dark ? 'rgba(167,139,250,0.45)' : '#E9D5FF',
            opacity: fade,
            transform: [
              {
                translateY: fade.interpolate({
                  inputRange: [0, 1],
                  outputRange: [cardBelow ? 12 : -12, 0],
                }),
              },
            ],
          },
        ]}>
        <Text style={[styles.title, { color: p.text }]}>{step.title}</Text>
        <Text style={[styles.body, { color: p.muted }]}>{step.text}</Text>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {TUTORIAL_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === stepIndex
                        ? violet[400]
                        : p.dark
                          ? 'rgba(255,255,255,0.2)'
                          : '#E9D5FF',
                    width: i === stepIndex ? 18 : 6,
                  },
                ]}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {!isLast && (
              <Pressable onPress={skip} hitSlop={10}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: font.bodyMedium,
                    color: p.faint,
                  }}>
                  Kihagyás
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={next}
              style={({ pressed }) => pressed && { transform: [{ scale: 0.95 }] }}>
              <LinearGradient
                colors={[violet[500], violet[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextBtn}>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: font.display,
                    color: '#fff',
                  }}>
                  {isLast ? 'Kezdjük!' : 'Következő'}
                </Text>
                {!isLast && <ChevronRight size={14} color="#fff" />}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 30,
  },
  card: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  title: {
    fontFamily: font.displayX,
    fontSize: 18,
    marginBottom: 6,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: font.body,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    height: 6,
    borderRadius: 999,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
});
