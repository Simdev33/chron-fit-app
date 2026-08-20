import { router, usePathname } from 'expo-router';
import { ChevronRight, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

import { font, violet } from '@/constants/figma';
import {
  tutorialSteps,
  useTutorial,
  type TutorialStep,
} from '@/context/TutorialContext';

const SCREEN_ROUTES: Record<TutorialStep['screen'], string> = {
  Home: '/',
  Lifestyle: '/lifestyle',
  Organizer: '/schedule',
  Health: '/medical',
};

const BACKDROP = 'rgba(0,0,0,0.6)';
const HOLE_PADDING = 10;
const HOLE_RADIUS = 20;
const MEASURE_ATTEMPTS = 12;
const MEASURE_RETRY_MS = 150;
const POST_NAV_DELAY_MS = 180;
/** Vertical room the step counter and the buttons take up. */
const CONTROLS_STRIP_H = 64;

export function TutorialManager() {
  const pathname = usePathname();
  const windowSize = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    active,
    currentStep,
    stepIndex,
    targetRect,
    transitioning,
    next,
    skip,
    measureTarget,
    setTargetRect,
    setTransitioning,
  } = useTutorial();

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let measurementStarted = false;

    setTargetRect(null);
    setTransitioning(true);

    const route = SCREEN_ROUTES[currentStep.screen];
    if (pathname !== route) {
      router.navigate(route as never);
    }

    const measure = async () => {
      const rect = await measureTarget(currentStep.targetId);
      if (cancelled) return;

      if (rect) {
        setTargetRect(rect);
        setTransitioning(false);
        return;
      }

      attempts += 1;
      if (attempts >= MEASURE_ATTEMPTS) {
        setTransitioning(false);
        return;
      }
      retryTimer = setTimeout(measure, MEASURE_RETRY_MS);
    };

    const startMeasurement = () => {
      if (cancelled || measurementStarted) return;
      measurementStarted = true;
      retryTimer = setTimeout(measure, POST_NAV_DELAY_MS);
    };

    // Waiting a frame lets the navigation commit before the first measure.
    // InteractionManager used to do this, but it is deprecated now.
    const frame = requestAnimationFrame(startMeasurement);
    fallbackTimer = setTimeout(startMeasurement, POST_NAV_DELAY_MS);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (retryTimer) clearTimeout(retryTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [
    active,
    currentStep.screen,
    currentStep.targetId,
    measureTarget,
    pathname,
    setTargetRect,
    setTransitioning,
  ]);

  const rootRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measureOrigin = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      setOrigin((current) =>
        current.x === x && current.y === y ? current : { x, y },
      );
    });
  }, []);

  // The origin can move between steps -- navigating changes what the system
  // bars overlay -- so it is re-read every time a new target is measured
  // rather than once on mount.
  useEffect(() => {
    if (!active || !targetRect) return;
    measureOrigin();
  }, [active, measureOrigin, targetRect]);

  if (!active) return null;

  // The overlay is only as big as its own box. Sizing the mask from the window
  // instead left the backdrop short and clamped the spotlight against the
  // wrong bottom edge, which is what pulled the frame off the tab bar.
  const width = size.width || windowSize.width;
  const height = size.height || windowSize.height;

  const hole = targetRect
    ? {
        x: Math.max(4, targetRect.x - origin.x - HOLE_PADDING),
        y: Math.max(4, targetRect.y - origin.y - HOLE_PADDING),
        width: Math.min(
          targetRect.width + HOLE_PADDING * 2,
          width - Math.max(4, targetRect.x - origin.x - HOLE_PADDING) - 4,
        ),
        height: Math.min(
          targetRect.height + HOLE_PADDING * 2,
          height - Math.max(4, targetRect.y - origin.y - HOLE_PADDING) - 4,
        ),
      }
    : null;

  const advanceLabel =
    currentStep.action === 'finish' ? 'Kezdjük!' : 'Következő';

  // The controls live at the top, but the first step highlights the header and
  // the buttons ended up sitting inside that frame. Rather than special-casing
  // step one, they move to the bottom whenever the spotlight reaches into the
  // strip they occupy.
  const controlsAtBottom = !!hole && hole.y < insets.top + CONTROLS_STRIP_H;
  const controlsPosition = controlsAtBottom
    ? { bottom: Math.max(insets.bottom, 12) + 16 }
    : { top: insets.top + 12 };

  return (
    <View
      ref={rootRef}
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        setSize((current) =>
          current.width === w && current.height === h
            ? current
            : { width: w, height: h },
        );
        measureOrigin();
      }}
      style={styles.root}
      pointerEvents="box-none">
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none">
        <Defs>
          <Mask id="tutorial-spotlight-mask">
            <Rect x={0} y={0} width={width} height={height} fill="#fff" />
            {hole ? (
              <Rect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={HOLE_RADIUS}
                fill="#000"
              />
            ) : null}
          </Mask>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={BACKDROP}
          mask="url(#tutorial-spotlight-mask)"
        />
        {hole ? (
          <>
            <Rect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx={HOLE_RADIUS}
              fill="none"
              stroke="rgba(167,139,250,0.32)"
              strokeWidth={9}
            />
            <Rect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx={HOLE_RADIUS}
              fill="none"
              stroke={violet[400]}
              strokeWidth={2}
            />
          </>
        ) : null}
      </Svg>

      <Pressable
        style={StyleSheet.absoluteFill}
        disabled={transitioning}
        onPress={next}
      />

      <View
        style={[styles.controls, controlsPosition]}
        pointerEvents="box-none">
        <View style={styles.progressPill}>
          <Text style={styles.progressText}>
            {stepIndex + 1}/{tutorialSteps.length}
          </Text>
        </View>

        <View style={styles.actions}>
          {currentStep.action !== 'finish' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bemutató kihagyása"
              hitSlop={10}
              onPress={skip}
              style={styles.skipButton}>
              <X size={14} color="rgba(255,255,255,0.72)" />
              <Text style={styles.skipText}>Kihagyás</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={advanceLabel}
            disabled={transitioning}
            onPress={next}
            style={({ pressed }) => [
              styles.nextButton,
              transitioning && styles.nextButtonDisabled,
              pressed && !transitioning && styles.nextButtonPressed,
            ]}>
            <Text style={styles.nextText}>
              {transitioning ? 'Egy pillanat…' : advanceLabel}
            </Text>
            {!transitioning && currentStep.action !== 'finish' ? (
              <ChevronRight size={14} color="#fff" />
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 900,
    elevation: 30,
  },
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressPill: {
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: 'rgba(18,8,40,0.86)',
    alignItems: 'center',
  },
  progressText: {
    color: '#fff',
    fontFamily: font.bodySemi,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: font.bodyMedium,
    fontSize: 12,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(216,180,254,0.55)',
    backgroundColor: 'rgba(124,58,237,0.94)',
  },
  nextButtonDisabled: {
    opacity: 0.65,
  },
  nextButtonPressed: {
    transform: [{ scale: 0.95 }],
  },
  nextText: {
    color: '#fff',
    fontFamily: font.display,
    fontSize: 12,
  },
});
