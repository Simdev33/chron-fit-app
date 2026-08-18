import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import { Asset } from 'expo-asset';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Swap these requires if you drop in new Flóra / smoke assets.
 * Transparent WebM/MP4 loops for each outfit, plus the purple smoke overlay.
 */
const FLORA_LOOKS = {
  alap: require('../../assets/flora/flora_alap.mp4'),
  fitnesz: require('../../assets/flora/flora_fitnesz.mp4'),
  titkarno: require('../../assets/flora/flora_titkarno.mp4'),
  nover: require('../../assets/flora/flora_nover.mp4'),
} as const;

const SMOKE_EFFECT = require('../../assets/flora/smoke_transition.mp4');

export type FloraLook = keyof typeof FLORA_LOOKS;

const LOOK_ORDER: FloraLook[] = ['alap', 'fitnesz', 'titkarno', 'nover'];

/** Fraction of the smoke clip where coverage is thickest. Tune per asset. */
export const SMOKE_PEAK_RATIO = 0.5;
const SMOKE_DURATION_FALLBACK_MS = 1800;
const CROSSFADE_MS = 280;
const FLOAT_PX = 13;

const WEB_VIDEO_FILL: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'center bottom',
  background: 'transparent',
};

export type FloatingAICompanionHandle = {
  triggerTransformation: (next?: FloraLook) => void;
  getLook: () => FloraLook;
};

type Props = {
  size?: number;
  initialLook?: FloraLook;
  onLookChange?: (look: FloraLook) => void;
  style?: StyleProp<ViewStyle>;
};

function getAssetUri(mod: unknown): string | undefined {
  if (typeof mod === 'string' && mod.length > 0) return mod;
  if (mod && typeof mod === 'object') {
    const rec = mod as { uri?: string; default?: string };
    if (typeof rec.uri === 'string' && rec.uri.length > 0) return rec.uri;
    if (typeof rec.default === 'string' && rec.default.length > 0) {
      return rec.default;
    }
  }
  try {
    const packed = Asset.fromModule(mod as number);
    return packed.localUri || packed.uri || undefined;
  } catch {
    return undefined;
  }
}

function nextLookAfter(current: FloraLook): FloraLook {
  const i = LOOK_ORDER.indexOf(current);
  return LOOK_ORDER[(i + 1) % LOOK_ORDER.length];
}

function LoopingCharacterVideo({ source }: { source: number }) {
  const webRef = useRef<HTMLVideoElement | null>(null);
  const uri = Platform.OS === 'web' ? getAssetUri(source) : undefined;

  const tryPlay = useCallback((node: HTMLVideoElement) => {
    node.muted = true;
    node.defaultMuted = true;
    node.loop = true;
    node.play()?.catch(() => {
      node.muted = true;
      node.play().catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = window.setInterval(() => {
      const node = webRef.current;
      if (node && node.paused && node.readyState >= 2) tryPlay(node);
    }, 500);
    return () => window.clearInterval(id);
  }, [source, tryPlay]);

  if (Platform.OS === 'web' && uri) {
    return (
      <video
        key={uri}
        ref={(node: HTMLVideoElement | null) => {
          webRef.current = node;
          if (node) tryPlay(node);
        }}
        src={uri}
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        style={WEB_VIDEO_FILL}
      />
    );
  }

  return (
    <Video
      source={source}
      style={StyleSheet.absoluteFill}
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay
      isLooping
      isMuted
      useNativeControls={false}
    />
  );
}

function SmokeOverlayVideo({
  playing,
  onDuration,
  onEnded,
}: {
  playing: boolean;
  onDuration: (ms: number) => void;
  onEnded: () => void;
}) {
  const nativeRef = useRef<Video>(null);
  const webRef = useRef<HTMLVideoElement | null>(null);
  const uri = Platform.OS === 'web' ? getAssetUri(SMOKE_EFFECT) : undefined;

  useEffect(() => {
    if (!playing) return;

    if (Platform.OS === 'web' && webRef.current) {
      const el = webRef.current;
      el.currentTime = 0;
      el.muted = true;
      el.play()?.catch(() => {});
      return;
    }

    void nativeRef.current?.setStatusAsync({
      positionMillis: 0,
      shouldPlay: true,
      isLooping: false,
      isMuted: true,
    });
  }, [playing]);

  if (Platform.OS === 'web' && uri) {
    return (
      <video
        ref={(node: HTMLVideoElement | null) => {
          webRef.current = node;
        }}
        src={uri}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(event: { currentTarget: HTMLVideoElement }) => {
          const sec = event.currentTarget.duration;
          if (Number.isFinite(sec) && sec > 0) onDuration(sec * 1000);
        }}
        onEnded={onEnded}
        style={{
          ...WEB_VIDEO_FILL,
          objectFit: 'cover',
          mixBlendMode: 'screen',
        }}
      />
    );
  }

  return (
    <Video
      ref={nativeRef}
      source={SMOKE_EFFECT}
      style={StyleSheet.absoluteFill}
      resizeMode={ResizeMode.COVER}
      shouldPlay={false}
      isLooping={false}
      isMuted
      useNativeControls={false}
      onLoad={(status: AVPlaybackStatus) => {
        if (status.isLoaded && status.durationMillis) {
          onDuration(status.durationMillis);
        }
      }}
      onPlaybackStatusUpdate={(status) => {
        if (status.isLoaded && status.didJustFinish) onEnded();
      }}
    />
  );
}

export const FloatingAICompanion = forwardRef<
  FloatingAICompanionHandle,
  Props
>(function FloatingAICompanion(
  { size = 240, initialLook = 'alap', onLookChange, style },
  ref,
) {
  const [look, setLook] = useState<FloraLook>(initialLook);
  const [slotA, setSlotA] = useState<FloraLook>(initialLook);
  const [slotB, setSlotB] = useState<FloraLook>(nextLookAfter(initialLook));
  const [frontIsA, setFrontIsA] = useState(true);
  const [smokePlaying, setSmokePlaying] = useState(false);

  const busyRef = useRef(false);
  const smokeMsRef = useRef(SMOKE_DURATION_FALLBACK_MS);
  const peakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookRef = useRef(look);
  lookRef.current = look;

  const floatY = useSharedValue(0);
  const opacityA = useSharedValue(1);
  const opacityB = useSharedValue(0);
  const smokeOpacity = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-FLOAT_PX, {
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(FLOAT_PX, {
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
  }, [floatY]);

  useEffect(
    () => () => {
      if (peakTimerRef.current) clearTimeout(peakTimerRef.current);
    },
    [],
  );

  const finishSmoke = useCallback(() => {
    smokeOpacity.value = withTiming(0, { duration: 420 });
    setSmokePlaying(false);
    busyRef.current = false;
  }, [smokeOpacity]);

  const triggerTransformation = useCallback(
    (forced?: FloraLook) => {
      if (busyRef.current) return;
      busyRef.current = true;

      const current = lookRef.current;
      const upcoming =
        forced && forced !== current ? forced : nextLookAfter(current);

      if (frontIsA) setSlotB(upcoming);
      else setSlotA(upcoming);

      setSmokePlaying(true);
      smokeOpacity.value = withTiming(1, { duration: 160 });

      const peakAt = smokeMsRef.current * SMOKE_PEAK_RATIO;
      if (peakTimerRef.current) clearTimeout(peakTimerRef.current);

      peakTimerRef.current = setTimeout(() => {
        // SMOKE PEAK SWAP — character layers crossfade while fully covered
        if (frontIsA) {
          opacityA.value = withTiming(0, { duration: CROSSFADE_MS });
          opacityB.value = withTiming(1, { duration: CROSSFADE_MS });
        } else {
          opacityB.value = withTiming(0, { duration: CROSSFADE_MS });
          opacityA.value = withTiming(1, { duration: CROSSFADE_MS });
        }
        setFrontIsA((v) => !v);
        setLook(upcoming);
        onLookChange?.(upcoming);
      }, peakAt);

      setTimeout(finishSmoke, smokeMsRef.current + 120);
    },
    [frontIsA, onLookChange, opacityA, opacityB, smokeOpacity],
  );

  useImperativeHandle(
    ref,
    () => ({
      triggerTransformation,
      getLook: () => lookRef.current,
    }),
    [triggerTransformation],
  );

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const layerAStyle = useAnimatedStyle(() => ({ opacity: opacityA.value }));
  const layerBStyle = useAnimatedStyle(() => ({ opacity: opacityB.value }));
  const smokeStyle = useAnimatedStyle(() => ({ opacity: smokeOpacity.value }));

  const stageSize = useMemo(
    () => ({ width: size, height: size * 1.18 }),
    [size],
  );

  return (
    <Animated.View style={[styles.wrap, stageSize, floatStyle, style]}>
      <Pressable
        onPress={() => triggerTransformation()}
        style={styles.hit}
        accessibilityRole="button"
        accessibilityLabel="Flóra, AI companion — tap to change outfit">
        <View
          pointerEvents="none"
          style={[
            styles.glow,
            { width: size * 0.58, height: 26, bottom: 10 },
          ]}
        />
        <View style={[styles.stage, stageSize]}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, layerAStyle]}>
            <LoopingCharacterVideo source={FLORA_LOOKS[slotA]} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, layerBStyle]}>
            <LoopingCharacterVideo source={FLORA_LOOKS[slotB]} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, smokeStyle]}>
            <SmokeOverlayVideo
              playing={smokePlaying}
              onDuration={(ms) => {
                if (ms > 200) smokeMsRef.current = ms;
              }}
              onEnded={finishSmoke}
            />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  hit: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(168, 85, 247, 0.28)',
    shadowColor: '#C084FC',
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  stage: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
