import { Asset } from 'expo-asset';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font } from '@/constants/figma';

const INTRO_VIDEO = require('../../assets/intro_video.mp4');
const LOGO = require('../../assets/crohnsync_text.png');

const BG = '#120524';
const GLASS = 'rgba(30, 15, 60, 0.6)';
const NEON = '#C084FC';
const NEON_SOFT = 'rgba(192, 132, 252, 0.45)';

const WEB_VIDEO_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center center',
};

type Props = {
  onDone: (name: string) => void;
};

function getIntroVideoUri(): string | undefined {
  const asset = INTRO_VIDEO as unknown;
  if (typeof asset === 'string' && asset.length > 0) return asset;
  if (asset && typeof asset === 'object') {
    const rec = asset as { uri?: string; default?: string };
    if (typeof rec.uri === 'string' && rec.uri.length > 0) return rec.uri;
    if (typeof rec.default === 'string' && rec.default.length > 0) {
      return rec.default;
    }
  }
  try {
    const packed = Asset.fromModule(INTRO_VIDEO as number);
    return packed.localUri || packed.uri || undefined;
  } catch {
    return undefined;
  }
}

function WebIntroVideo({
  videoRef,
  onEnded,
  onError,
}: {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onEnded: () => void;
  onError: () => void;
}) {
  const uri = getIntroVideoUri();
  const finishedRef = useRef(false);

  const tryPlay = useCallback((node: HTMLVideoElement) => {
    if (finishedRef.current) return;
    node.muted = true;
    node.defaultMuted = true;
    const play = node.play();
    if (play) {
      play.catch(() => {
        if (finishedRef.current) return;
        node.muted = true;
        node.play().catch(() => {});
      });
    }
  }, []);

  const bind = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (!node) return;
      node.muted = true;
      node.defaultMuted = true;
      node.playsInline = true;
      node.setAttribute('playsinline', 'true');
      node.setAttribute('muted', 'true');
      node.preload = 'auto';
      tryPlay(node);
    },
    [tryPlay, videoRef],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      const node = videoRef.current;
      if (!node || finishedRef.current || node.ended) return;
      if (node.paused && node.readyState >= 2) tryPlay(node);
    }, 400);
    return () => window.clearInterval(id);
  }, [tryPlay, uri, videoRef]);

  return (
    <video
      ref={bind}
      src={uri}
      muted
      autoPlay
      playsInline
      preload="auto"
      controls={false}
      onEnded={() => {
        finishedRef.current = true;
        onEnded();
      }}
      onError={onError}
      style={WEB_VIDEO_STYLE}
    />
  );
}

export function WelcomeSplash({ onDone }: Props) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const revealedRef = useRef(false);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(INTRO_VIDEO, (instance) => {
    instance.loop = false;
    instance.muted = Platform.OS === 'web';
    instance.play();
  });

  const [name, setName] = useState('');
  const [sheetReady, setSheetReady] = useState(false);

  const sheetHeight = height * 0.56;
  const sheetY = useSharedValue(height);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.9);
  const glowPulse = useSharedValue(0.35);

  const freezeLastFrame = useCallback(() => {
    if (Platform.OS === 'web' && webVideoRef.current) {
      const el = webVideoRef.current;
      el.pause();
      if (Number.isFinite(el.duration) && el.duration > 0) {
        el.currentTime = Math.max(0, el.duration - 0.05);
      }
      return;
    }
    // Parking just short of the end keeps the closing frame on screen while
    // the sheet slides up, instead of dropping to black.
    try {
      player.pause();
      if (Number.isFinite(player.duration) && player.duration > 0) {
        player.currentTime = Math.max(0, player.duration - 0.06);
      }
    } catch {
      // Last frame is already visible if seeking is unsupported.
    }
  }, [player]);

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    if (fallbackRef.current) clearTimeout(fallbackRef.current);
    setSheetReady(true);

    logoOpacity.value = withTiming(1, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });

    logoScale.value = withSequence(
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
      withRepeat(
        withSequence(
          withTiming(1.045, {
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0.985, {
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        true,
      ),
    );

    glowPulse.value = withRepeat(
      withSequence(
        withTiming(0.95, {
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0.4, {
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );

    sheetY.value = withSpring(0, {
      damping: 17,
      stiffness: 78,
      mass: 0.9,
      overshootClamping: false,
    });
  }, [glowPulse, logoOpacity, logoScale, sheetY]);


  useEventListener(player, 'playToEnd', () => {
    freezeLastFrame();
    reveal();
  });

  // A clip that cannot load must not leave the user staring at a black screen.
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') reveal();
  });

  useEffect(() => {
    fallbackRef.current = setTimeout(reveal, 18000);
    return () => {
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
    };
  }, [reveal]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value,
    transform: [{ scale: 0.92 + glowPulse.value * 0.12 }],
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const canContinue = name.trim().length >= 2;

  const submit = () => {
    if (!canContinue) return;
    onDone(name.trim());
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.videoClip} pointerEvents="none">
        {Platform.OS === 'web' && getIntroVideoUri() ? (
          <WebIntroVideo
            videoRef={webVideoRef}
            onEnded={() => {
              void freezeLastFrame();
              reveal();
            }}
            onError={() => reveal()}
          />
        ) : (
          <VideoView
            player={player}
            style={styles.videoFill}
            contentFit="cover"
            nativeControls={false}
          />
        )}
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(18, 5, 36, 0.2)', 'transparent', 'rgba(18, 5, 36, 0.55)']}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.logoBlock,
          {
            top: insets.top + height * 0.07,
            width,
            height: Math.min(88, height * 0.11),
          },
          logoStyle,
        ]}>
        <Animated.View style={[styles.logoGlow, glowStyle]} />
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      </Animated.View>

      <KeyboardAvoidingView
        pointerEvents={sheetReady ? 'auto' : 'none'}
        behavior="padding"
        style={styles.sheetDock}>
        <Animated.View style={[{ height: sheetHeight }, sheetStyle]}>
          <View style={styles.sheetClip}>
            <BlurView
              intensity={42}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.glassFill} />
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(192, 132, 252, 0.35)',
                'rgba(192, 132, 252, 0.05)',
                'transparent',
              ]}
              style={styles.sheetSheen}
            />

            <View
              style={[
                styles.sheetInner,
                { paddingBottom: Math.max(insets.bottom, 16) + 8 },
              ]}>
              <View style={styles.handle} />

              <Text style={styles.welcome}>Welcome to CrohnSync</Text>
              <Text style={styles.sub}>
                A cinematic companion for IBD — start with your name.
              </Text>

              <View style={styles.inputWrap}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  style={styles.input}
                />
              </View>

              <Pressable
                onPress={submit}
                disabled={!canContinue}
                style={({ pressed }) => [
                  styles.ctaHit,
                  pressed && canContinue && { transform: [{ scale: 0.97 }] },
                  !canContinue && { opacity: 0.45 },
                ]}>
                <LinearGradient
                  colors={['#C084FC', '#7C3AED', '#6D28D9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cta}>
                  <Text style={styles.ctaLabel}>Continue</Text>
                  <ArrowRight size={18} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  videoClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoFill: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  videoElement: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    // @ts-expect-error web-only CSS property, applied by react-native-web
    objectPosition: 'center center',
  },
  logoBlock: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  logoGlow: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 80,
    backgroundColor: 'rgba(168, 85, 247, 0.28)',
    shadowColor: NEON,
    shadowOpacity: 0.85,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 0 },
  },
  logo: {
    width: '88%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  sheetDock: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 3,
  },
  sheetClip: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.28)',
    borderBottomWidth: 0,
  },
  glassFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: GLASS,
  },
  sheetSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  sheetInner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: NEON_SOFT,
    marginBottom: 22,
  },
  welcome: {
    color: '#FFFFFF',
    fontFamily: font.displayX,
    fontSize: 28,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  sub: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.58)',
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  inputWrap: {
    marginTop: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowColor: NEON,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: '#FFFFFF',
    fontFamily: font.bodyMedium,
    fontSize: 16,
  },
  ctaHit: {
    marginTop: 18,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cta: {
    height: 54,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#A855F7',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  ctaLabel: {
    color: '#fff',
    fontFamily: font.display,
    fontSize: 16,
    letterSpacing: 0.4,
  },
});
