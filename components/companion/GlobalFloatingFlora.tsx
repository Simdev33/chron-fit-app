import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font } from '@/constants/figma';
import { useFloraScene, type LifestylePane } from '@/context/FloraSceneContext';
import { useProfile } from '@/context/ProfileContext';
import { useTutorial } from '@/context/TutorialContext';
import {
  subscribeFloraSpeech,
  triggerFloraSpeech,
} from '@/utils/floraSpeech';

export { triggerFloraSpeech };

/**
 * PLACE this component in `app/(tabs)/_layout.tsx` as a SIBLING of <Tabs>,
 * not inside an individual screen. That way Flóra stays mounted while the
 * user switches Home / Diet / Schedule / Medical.
 *
 * Do NOT put her inside the root Stack if you want her hidden on ChatbotScreen —
 * the tab layout already uncovers when `/chatbot` is pushed.
 */

export type FloraLook = 'alap' | 'sef' | 'fitnesz' | 'titkarno' | 'nover';
type FloraVideoMode = 'action' | 'idle';

const FLORA_CLIPS: Record<
  FloraLook,
  Record<FloraVideoMode, number>
> = {
  alap: {
    action: require('../../assets/flora/flora_assistant_action.webp'),
    idle: require('../../assets/flora/flora_assistant_idle.webp'),
  },
  sef: {
    action: require('../../assets/flora/flora_chef_action.webp'),
    idle: require('../../assets/flora/flora_chef_idle.webp'),
  },
  fitnesz: {
    action: require('../../assets/flora/flora_gym_action.webp'),
    idle: require('../../assets/flora/flora_gym_idle.webp'),
  },
  titkarno: {
    action: require('../../assets/flora/flora_assistant_action.webp'),
    idle: require('../../assets/flora/flora_assistant_idle.webp'),
  },
  nover: {
    action: require('../../assets/flora/flora_nurse_action.webp'),
    idle: require('../../assets/flora/flora_nurse_idle.webp'),
  },
};

const FLORA_SPEECH: Record<FloraLook, string> = {
  alap: 'Szia! Itt a kezdőlapod — miben segíthetek ma?',
  sef: 'Nézzük az étrended. Figyelek a kalóriákra és a jóllétedre is.',
  fitnesz: 'Mozgásidő! Kíméletes, IBD-barát edzést javaslok.',
  titkarno: 'Itt a szerveződ: gyógyszerek és időpontok egy helyen.',
  nover: 'Egészségnapló — tünetek, gyógyszerek, állapot. Veled vagyok.',
};

function lookForRoute(
  pathname: string,
  segments: string[],
  lifestylePane: LifestylePane,
): FloraLook {
  const hay = `${pathname} ${segments.join('/')}`.toLowerCase();
  if (hay.includes('lifestyle')) {
    return lifestylePane === 'fitness' ? 'fitnesz' : 'sef';
  }
  if (hay.includes('schedule')) return 'titkarno';
  if (hay.includes('medical')) return 'nover';
  if (hay.includes('workout')) return 'fitnesz';
  return 'alap';
}

const FAB_W = 108;
const FAB_H = 108;
const FLOAT_PX = 10;
const EDGE_PADDING = 10;
const BUBBLE_ANCHOR_INSET = 6;
const BUBBLE_SCREEN_MARGIN = 12;
const BUBBLE_TAIL_INSET = 18;
const TUTORIAL_BUBBLE_MAX_W = 280;
const CLOSE_TARGET_SIZE = 76;
/** The exit that plays when she is dropped on the X, and its reverse. */
const EXIT_MS = 260;
const EXIT_SCALE = 0.18;
const CLOSE_SNAP_DISTANCE = 88;
// Mirrors the floating tab bar in app/(tabs)/_layout.tsx: its wrap sits at
// bottom 0 with paddingBottom max(insets.bottom, 12) + 4, and the bar itself
// is content-sized to roughly this height.
const CLOSE_TAB_BAR_H = 90;
const CLOSE_TAB_BAR_INSET = 12;
const CLOSE_DOCK_GAP = 14;
const CLOSE_LABEL_BLOCK = 24;
const CLOSE_GLOW_PAD = 36;
const CLOSE_SCRIM_H = 260;
const CLOSE_RISE_PX = 130;
// The clips are portrait, so cover inside a round window crops top and bottom
// and takes her head with it. Extending the view below the circle biases that
// crop toward the top of the clip, where her head is. Moving the view with a
// transform instead just slid it down and left the black backdrop showing.
// Raise this to reveal more of her head, lower it to show more torso.
const FLORA_VIDEO_EXTEND_Y = 36;
const SPEECH_HOLD_MS = 5000;
const ACTION_REPLAY_MS = 30_000;
const BUBBLE_PURPLE = 'rgba(176, 38, 255, 0.4)';

/**
 * Her clips are animated WebP now, so they are just images: no player, no
 * surface, no shutter blanking the circle between outfits, and one code path
 * for every platform. The trade is that an animated image reports nothing
 * about its playback, so the end of an action clip has to be timed.
 */
const ACTION_CLIP_MS = 4000;

function FloraVideo({
  look,
  mode,
  onActionEnded,
}: {
  look: FloraLook;
  mode: FloraVideoMode;
  onActionEnded: () => void;
}) {
  const source = FLORA_CLIPS[look][mode];

  useEffect(() => {
    if (mode !== 'action') return;
    const timer = setTimeout(onActionEnded, ACTION_CLIP_MS);
    return () => clearTimeout(timer);
  }, [look, mode, onActionEnded]);

  return (
    <Image
      source={source}
      style={[StyleSheet.absoluteFill, styles.nativeVideo]}
      contentFit="cover"
      // Swapping the source in place keeps the previous outfit on screen until
      // the next one is ready. A recyclingKey would blank it first, which is
      // the very flicker this replaced.
      cachePolicy="memory-disk"
    />
  );
}

function FloraSpeechBubble({
  text,
  edge,
  placement,
  tailOffset = 0,
}: {
  text: string;
  edge: 'left' | 'right';
  placement: 'above' | 'below';
  tailOffset?: number;
}) {
  const tail = (
    <View
      style={[
        styles.tailWrap,
        edge === 'left' && styles.tailWrapLeft,
        placement === 'below' && styles.tailWrapAbove,
        edge === 'left'
          ? { marginLeft: BUBBLE_TAIL_INSET + tailOffset }
          : { marginRight: BUBBLE_TAIL_INSET + tailOffset },
      ]}
      pointerEvents="none">
      <View
        style={[
          styles.tailBorder,
          placement === 'below' && styles.tailBorderUp,
        ]}
      />
      <View
        style={[
          styles.tailFill,
          placement === 'below' && styles.tailFillUp,
        ]}
      />
    </View>
  );

  return (
    <View
      style={[
        styles.bubbleInner,
        edge === 'left' && styles.bubbleInnerLeft,
      ]}
      pointerEvents="none">
      {placement === 'below' ? tail : null}
      <BlurView
        intensity={48}
        tint="dark"
        style={styles.bubbleGlass}>
        <View style={styles.bubbleTint}>
          <Text style={styles.bubbleText}>{text}</Text>
        </View>
      </BlurView>
      {placement === 'above' ? tail : null}
    </View>
  );
}

export function GlobalFloatingFlora() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { lifestylePane, showFloraHint } = useFloraScene();
  const { profile, updateProfile } = useProfile();
  const {
    active: tutorialActive,
    currentStep,
    targetRect,
    transitioning: tutorialTransitioning,
    next: nextTutorialStep,
  } = useTutorial();
  const targetLook = lookForRoute(
    pathname,
    segments as string[],
    lifestylePane,
  );

  const lookRef = useRef<FloraLook>(targetLook);
  const [videoMode, setVideoMode] = useState<FloraVideoMode>('action');
  const initialX = Math.max(EDGE_PADDING, width - FAB_W - 16);
  const initialY = Math.max(
    insets.top + EDGE_PADDING,
    height - FAB_H - Math.max(insets.bottom, 12) - 108,
  );
  const dragX = useSharedValue(initialX);
  const dragY = useSharedValue(initialY);
  const dragStartX = useSharedValue(initialX);
  const dragStartY = useSharedValue(initialY);
  const savedX = useSharedValue(initialX);
  const savedY = useSharedValue(initialY);
  const floatY = useSharedValue(0);
  const bubbleScale = useSharedValue(0);
  const bubbleOpacity = useSharedValue(0);
  const closeReveal = useSharedValue(0);
  // She used to blink out the instant she was dropped on the X. These drive a
  // short exit instead: she is pulled into the button while shrinking away.
  const exitScale = useSharedValue(1);
  const exitOpacity = useSharedValue(1);
  const dismissing = useSharedValue(0);

  const [speech, setSpeech] = useState<string | null>(null);
  const [edge, setEdge] = useState<'left' | 'right'>('right');
  const speechGen = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tutorialModeRef = useRef(false);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-FLOAT_PX, {
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(FLOAT_PX, {
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
  }, [floatY]);

  useEffect(() => {
    if (tutorialActive) return;
    const maxX = Math.max(EDGE_PADDING, width - FAB_W - EDGE_PADDING);
    const minY = insets.top + EDGE_PADDING;
    const maxY = Math.max(
      minY,
      height - FAB_H - Math.max(insets.bottom, EDGE_PADDING) - EDGE_PADDING,
    );
    const snapLeft = dragX.value + FAB_W / 2 < width / 2;
    dragX.value = withSpring(snapLeft ? EDGE_PADDING : maxX);
    dragY.value = withSpring(
      Math.min(maxY, Math.max(minY, dragY.value)),
    );
    setEdge(snapLeft ? 'left' : 'right');
  }, [
    dragX,
    dragY,
    height,
    insets.bottom,
    insets.top,
    tutorialActive,
    width,
  ]);

  useEffect(() => {
    const minY = insets.top + EDGE_PADDING;
    const maxX = Math.max(EDGE_PADDING, width - FAB_W - EDGE_PADDING);
    const maxY = Math.max(
      minY,
      height - FAB_H - Math.max(insets.bottom, EDGE_PADDING) - EDGE_PADDING,
    );

    if (tutorialActive) {
      if (!tutorialModeRef.current) {
        tutorialModeRef.current = true;
        savedX.value = dragX.value;
        savedY.value = dragY.value;
      }
      if (!targetRect) return;

      const targetCenterX = targetRect.x + targetRect.width / 2;
      const targetCenterY = targetRect.y + targetRect.height / 2;
      const nextX = Math.min(
        maxX,
        Math.max(EDGE_PADDING, targetCenterX - FAB_W / 2),
      );
      const nextY = Math.min(
        maxY,
        Math.max(minY, targetCenterY - FAB_H / 2),
      );
      dragX.value = withSpring(nextX, { damping: 17, stiffness: 190 });
      dragY.value = withSpring(nextY, { damping: 17, stiffness: 190 });
      setEdge(targetCenterX < width / 2 ? 'left' : 'right');
      return;
    }

    if (!tutorialModeRef.current) return;
    tutorialModeRef.current = false;
    const snapLeft = savedX.value + FAB_W / 2 < width / 2;
    dragX.value = withSpring(snapLeft ? EDGE_PADDING : maxX, {
      damping: 18,
      stiffness: 220,
    });
    dragY.value = withSpring(
      Math.min(maxY, Math.max(minY, savedY.value)),
      { damping: 18, stiffness: 220 },
    );
    setEdge(snapLeft ? 'left' : 'right');
  }, [
    dragX,
    dragY,
    height,
    insets.bottom,
    insets.top,
    savedX,
    savedY,
    targetRect,
    tutorialActive,
    width,
  ]);

  useEffect(() => {
    if (targetLook === lookRef.current) return;
    lookRef.current = targetLook;
    setVideoMode('action');
    if (tutorialActive) return;
    triggerFloraSpeech(FLORA_SPEECH[targetLook]);
  }, [targetLook, tutorialActive]);

  useEffect(() => {
    if (videoMode !== 'idle') return;
    const replayTimer = setTimeout(() => {
      setVideoMode('action');
    }, ACTION_REPLAY_MS);
    return () => clearTimeout(replayTimer);
  }, [targetLook, videoMode]);

  const finishActionVideo = useCallback(() => {
    setVideoMode((current) => (current === 'action' ? 'idle' : current));
  }, []);

  const clearSpeech = useCallback(() => {
    setSpeech(null);
    bubbleScale.value = 0;
    bubbleOpacity.value = 0;
  }, [bubbleOpacity, bubbleScale]);

  const clearSpeechIfCurrent = useCallback(
    (generation: number) => {
      if (speechGen.current === generation) clearSpeech();
    },
    [clearSpeech],
  );

  const showSpeech = useCallback(
    (message: string) => {
      if (tutorialActive) return;
      const text = message.trim();
      if (!text) return;
      speechGen.current += 1;
      const gen = speechGen.current;
      if (hideTimer.current) clearTimeout(hideTimer.current);

      setSpeech(text);
      bubbleScale.value = 0;
      bubbleOpacity.value = 0;
      bubbleScale.value = withSpring(1, {
        damping: 13,
        stiffness: 240,
        mass: 0.55,
      });
      bubbleOpacity.value = withTiming(1, { duration: 180 });

      hideTimer.current = setTimeout(() => {
        if (speechGen.current !== gen) return;
        bubbleOpacity.value = withTiming(0, { duration: 240 });
        bubbleScale.value = withTiming(
          0.78,
          { duration: 240, easing: Easing.in(Easing.cubic) },
          (finished) => {
            // Reading speechGen here would capture the ref into this worklet,
            // and Reanimated freezes what a worklet closes over — every later
            // bump of the counter on the JS side then warns. The comparison
            // belongs on the thread that owns the ref.
            if (finished) runOnJS(clearSpeechIfCurrent)(gen);
          },
        );
      }, SPEECH_HOLD_MS);
    },
    [bubbleOpacity, bubbleScale, clearSpeechIfCurrent, tutorialActive],
  );

  useEffect(() => {
    if (!tutorialActive) {
      if (!speech) {
        bubbleScale.value = 0;
        bubbleOpacity.value = 0;
      }
      return;
    }
    if (tutorialTransitioning) return;

    speechGen.current += 1;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    bubbleScale.value = 0;
    bubbleOpacity.value = 0;
    bubbleScale.value = withSpring(1, {
      damping: 13,
      stiffness: 230,
      mass: 0.58,
    });
    bubbleOpacity.value = withTiming(1, { duration: 180 });
  }, [
    bubbleOpacity,
    bubbleScale,
    currentStep.step,
    speech,
    targetRect,
    tutorialActive,
    tutorialTransitioning,
  ]);

  useEffect(() => {
    return subscribeFloraSpeech((message) => {
      showSpeech(typeof message === 'string' ? message : String(message));
    });
  }, [showSpeech]);

  useEffect(() => {
    if (tutorialActive) return;
    triggerFloraSpeech(FLORA_SPEECH[targetLook]);
  }, [targetLook, tutorialActive]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: bubbleOpacity.value,
    transform: [{ scale: bubbleScale.value }],
    transformOrigin: 'bottom right',
  }));
  const dragStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: exitScale.value },
    ],
  }));

  const openChatbot = useCallback(() => {
    if (tutorialActive) {
      nextTutorialStep();
      return;
    }
    router.push('/chatbot');
  }, [nextTutorialStep, router, tutorialActive]);

  const setSnappedEdge = useCallback((next: 'left' | 'right') => {
    setEdge(next);
  }, []);

  const hideFlora = useCallback(() => {
    updateProfile({ floraHidden: true });
    showFloraHint();
  }, [showFloraHint, updateProfile]);

  const onChatbotRoute =
    pathname.includes('chatbot') || (segments as string[]).includes('chatbot');
  // A dismissed Flora still has to appear for the tutorial, which speaks
  // through her bubble and would otherwise be silent. Her entry follows what
  // is actually on screen, not the stored flag, or she would stay invisible
  // for the whole walkthrough.
  const hidden = onChatbotRoute || (profile.floraHidden && !tutorialActive);

  // Park her back at the default spot once she has been dismissed. Leaving the
  // drag position over the drop zone would light the danger tint the moment she
  // is brought back and grabbed again. This is deliberately tied to the
  // dismissal and not to visibility, so a trip to the chatbot does not move her
  // from wherever she was left.
  useEffect(() => {
    if (!profile.floraHidden) return;
    dragX.value = initialX;
    dragY.value = initialY;
    setEdge('right');
  }, [dragX, dragY, initialX, initialY, profile.floraHidden]);

  // Wind the exit values back up while she is off screen, so whatever brings
  // her back plays the drop into the X in reverse.
  useEffect(() => {
    if (!hidden) return;
    exitScale.value = EXIT_SCALE;
    exitOpacity.value = 0;
  }, [exitOpacity, exitScale, hidden]);

  // Only after an absence -- on a first launch she is simply there.
  const wasHidden = useRef(false);
  useEffect(() => {
    if (hidden) {
      wasHidden.current = true;
      return;
    }
    if (!wasHidden.current) return;
    wasHidden.current = false;
    exitScale.value = withSpring(1, { damping: 12, stiffness: 190 });
    exitOpacity.value = withTiming(1, { duration: EXIT_MS });
  }, [exitOpacity, exitScale, hidden]);

  // The dock rises from the bottom edge, clear of the floating tab bar.
  const closeDockBottom =
    Math.max(insets.bottom, CLOSE_TAB_BAR_INSET) +
    4 +
    CLOSE_TAB_BAR_H +
    CLOSE_DOCK_GAP;
  // Measured rather than derived. Both values land in the same coordinate
  // space as dragX/dragY, because the dock and Flora share a parent.
  const closeTargetX = useSharedValue(width / 2);
  const closeTargetY = useSharedValue(
    height - closeDockBottom - CLOSE_LABEL_BLOCK - CLOSE_TARGET_SIZE / 2,
  );
  const dockTop = useRef(0);
  const buttonOffset = useRef({ x: width / 2, y: 0 });

  const applyTargetCentre = useCallback(() => {
    closeTargetX.value = buttonOffset.current.x;
    closeTargetY.value = dockTop.current + buttonOffset.current.y;
  }, [closeTargetX, closeTargetY]);

  const isOverCloseTarget = () => {
    'worklet';
    const dx = dragX.value + FAB_W / 2 - closeTargetX.value;
    const dy = dragY.value + FAB_H / 2 - closeTargetY.value;
    return Math.sqrt(dx * dx + dy * dy) < CLOSE_SNAP_DISTANCE;
  };

  const closeDockStyle = useAnimatedStyle(() => ({
    opacity: closeReveal.value,
    transform: [{ translateY: (1 - closeReveal.value) * CLOSE_RISE_PX }],
  }));

  const closeScrimStyle = useAnimatedStyle(() => ({
    opacity: closeReveal.value,
  }));

  const closeButtonStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withTiming(isOverCloseTarget() ? 1.14 : 1, { duration: 140 }) },
    ],
  }));

  const closeDangerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isOverCloseTarget() ? 1 : 0, { duration: 140 }),
  }));

  const closeGlowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isOverCloseTarget() ? 0.95 : 0.4, { duration: 140 }),
    transform: [
      { scale: withTiming(isOverCloseTarget() ? 1.18 : 1, { duration: 140 }) },
    ],
  }));

  const minY = insets.top + EDGE_PADDING;
  const maxX = Math.max(EDGE_PADDING, width - FAB_W - EDGE_PADDING);
  const maxY = Math.max(
    minY,
    height - FAB_H - Math.max(insets.bottom, EDGE_PADDING) - EDGE_PADDING,
  );

  const panGesture = Gesture.Pan()
    .enabled(!tutorialActive)
    .minDistance(6)
    .onBegin(() => {
      dragStartX.value = dragX.value;
      dragStartY.value = dragY.value;
    })
    .onStart(() => {
      closeReveal.value = withSpring(1, { damping: 16, stiffness: 170 });
    })
    .onUpdate((event) => {
      dragX.value = Math.min(
        maxX,
        Math.max(EDGE_PADDING, dragStartX.value + event.translationX),
      );
      dragY.value = Math.min(
        maxY,
        Math.max(minY, dragStartY.value + event.translationY),
      );
    })
    .onEnd(() => {
      if (isOverCloseTarget()) {
        // Resetting her position here made her jump back to the edge for a
        // frame before vanishing. The reset now happens once she is hidden,
        // where nobody can see it.
        dismissing.value = 1;
        const settle = { duration: EXIT_MS };
        dragX.value = withTiming(closeTargetX.value - FAB_W / 2, settle);
        dragY.value = withTiming(closeTargetY.value - FAB_H / 2, settle);
        exitScale.value = withTiming(EXIT_SCALE, settle);
        exitOpacity.value = withTiming(0, settle, (finished) => {
          // Hiding her only once the exit has played keeps the component
          // mounted for its own animation.
          if (finished) runOnJS(hideFlora)();
          // The dock waited for her; it can go now.
          dismissing.value = 0;
          closeReveal.value = withTiming(0, { duration: 180 });
        });
        return;
      }

      const snapLeft = dragX.value + FAB_W / 2 < width / 2;
      dragX.value = withSpring(snapLeft ? EDGE_PADDING : maxX, {
        damping: 18,
        stiffness: 220,
      });
      dragY.value = withSpring(
        Math.min(maxY, Math.max(minY, dragY.value)),
        { damping: 18, stiffness: 220 },
      );
      runOnJS(setSnappedEdge)(snapLeft ? 'left' : 'right');
    })
    .onFinalize(() => {
      // While she is being absorbed the dock has to stay put, otherwise she
      // flies into an X that is no longer there.
      if (dismissing.value) return;
      closeReveal.value = withTiming(0, { duration: 180 });
    });

  const tapGesture = Gesture.Tap()
    .maxDistance(8)
    .maxDuration(300)
    .onEnd((_event, success) => {
      if (success) runOnJS(openChatbot)();
    });

  const floraGesture = Gesture.Exclusive(panGesture, tapGesture);

  if (hidden) return null;

  const bubbleText = tutorialActive ? currentStep.text : speech;
  const bubblePlacement: 'above' | 'below' =
    tutorialActive && targetRect && targetRect.y < height * 0.38
      ? 'below'
      : 'above';

  // The bubble is anchored to the avatar but is much wider, so on a
  // centred target it overflows the screen edge. Slide it back into view and
  // move the tail the same amount the other way so it still points at Flora.
  const tutorialBubbleWidth = Math.min(
    TUTORIAL_BUBBLE_MAX_W,
    width - BUBBLE_SCREEN_MARGIN * 2,
  );
  let tutorialBubbleShift = 0;
  if (tutorialActive && targetRect) {
    const maxX = Math.max(EDGE_PADDING, width - FAB_W - EDGE_PADDING);
    const targetCenterX = targetRect.x + targetRect.width / 2;
    const fabX = Math.min(
      maxX,
      Math.max(EDGE_PADDING, targetCenterX - FAB_W / 2),
    );
    if (edge === 'left') {
      const overflowRight =
        fabX +
        BUBBLE_ANCHOR_INSET +
        tutorialBubbleWidth -
        (width - BUBBLE_SCREEN_MARGIN);
      tutorialBubbleShift = -Math.max(0, overflowRight);
    } else {
      const bubbleLeft =
        fabX + FAB_W - BUBBLE_ANCHOR_INSET - tutorialBubbleWidth;
      tutorialBubbleShift = Math.max(0, BUBBLE_SCREEN_MARGIN - bubbleLeft);
    }
  }

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.closeScrim, closeScrimStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(12, 4, 26, 0.78)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        onLayout={(event) => {
          dockTop.current = event.nativeEvent.layout.y;
          applyTargetCentre();
        }}
        style={[
          styles.closeDock,
          { bottom: closeDockBottom },
          closeDockStyle,
        ]}>
        <View
          style={styles.closeButtonWrap}
          onLayout={(event) => {
            const { x, y, width: w, height: h } = event.nativeEvent.layout;
            buttonOffset.current = { x: x + w / 2, y: y + h / 2 };
            applyTargetCentre();
          }}>
          <Animated.View style={[styles.closeGlow, closeGlowStyle]} />
          <Animated.View style={[styles.closeButton, closeButtonStyle]}>
            <LinearGradient
              colors={['rgba(216, 180, 254, 0.55)', 'rgba(109, 40, 217, 0.85)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View
              style={[StyleSheet.absoluteFill, closeDangerStyle]}>
              <LinearGradient
                colors={['rgba(253, 164, 175, 0.9)', 'rgba(190, 18, 60, 0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <X size={26} color="#FFFFFF" strokeWidth={2.5} />
          </Animated.View>
        </View>
        <Text style={styles.closeLabel}>Bezárás</Text>
      </Animated.View>
      <GestureDetector gesture={floraGesture}>
      <Animated.View
        style={[
          styles.fab,
          tutorialActive && styles.fabTutorial,
          dragStyle,
        ]}>
        <Animated.View style={[styles.floatLayer, floatStyle]}>
          {bubbleText && (!tutorialActive || !tutorialTransitioning) ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bubbleAnchor,
                bubblePlacement === 'below' && styles.bubbleAnchorBelow,
                edge === 'left' && styles.bubbleAnchorLeft,
                tutorialActive && {
                  width: tutorialBubbleWidth,
                  maxWidth: tutorialBubbleWidth,
                },
                tutorialBubbleShift !== 0 &&
                  (edge === 'left'
                    ? { left: BUBBLE_ANCHOR_INSET + tutorialBubbleShift }
                    : { right: BUBBLE_ANCHOR_INSET - tutorialBubbleShift }),
                bubbleStyle,
              ]}>
              <FloraSpeechBubble
                text={bubbleText}
                edge={edge}
                placement={bubblePlacement}
                tailOffset={Math.abs(tutorialBubbleShift)}
              />
            </Animated.View>
          ) : null}
          <View
            accessible
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={
              tutorialActive
                ? `Tutorial, ${currentStep.step}. lépés`
                : 'Flóra AI chatbot'
            }
            onAccessibilityTap={openChatbot}
            style={styles.avatar}>
            <View style={styles.stage}>
              <FloraVideo
                look={targetLook}
                mode={videoMode}
                onActionEnded={finishActionVideo}
              />
            </View>
          </View>
        </Animated.View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FAB_W,
    height: FAB_H,
    zIndex: 80,
  },
  fabTutorial: {
    zIndex: 1001,
    elevation: 40,
  },
  floatLayer: {
    width: FAB_W,
    height: FAB_H,
  },
  avatar: {
    width: FAB_W,
    height: FAB_H,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: FAB_W / 2,
    shadowColor: '#B026FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 18,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 28px rgba(176, 38, 255, 0.9)' }
      : null),
  },
  stage: {
    width: FAB_W,
    height: FAB_H,
    borderRadius: FAB_W / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#B026FF',
    backgroundColor: '#08030F',
  },
  closeScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: CLOSE_SCRIM_H,
    zIndex: 60,
  },
  closeDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 70,
  },
  closeButtonWrap: {
    width: CLOSE_TARGET_SIZE,
    height: CLOSE_TARGET_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlow: {
    position: 'absolute',
    width: CLOSE_TARGET_SIZE + CLOSE_GLOW_PAD,
    height: CLOSE_TARGET_SIZE + CLOSE_GLOW_PAD,
    borderRadius: (CLOSE_TARGET_SIZE + CLOSE_GLOW_PAD) / 2,
    backgroundColor: 'rgba(192, 132, 252, 0.3)',
  },
  closeButton: {
    width: CLOSE_TARGET_SIZE,
    height: CLOSE_TARGET_SIZE,
    borderRadius: CLOSE_TARGET_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  closeLabel: {
    marginTop: 8,
    color: '#FFFFFF',
    fontFamily: font.bodySemi,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  bubbleAnchor: {
    position: 'absolute',
    right: 6,
    bottom: FAB_H + 4,
    maxWidth: 228,
    zIndex: 4,
  },
  bubbleAnchorBelow: {
    bottom: undefined,
    top: FAB_H + 4,
  },
  bubbleAnchorLeft: {
    right: undefined,
    left: 6,
  },
  bubbleInner: {
    alignItems: 'flex-end',
  },
  bubbleInnerLeft: {
    alignItems: 'flex-start',
  },
  bubbleGlass: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BUBBLE_PURPLE,
    backgroundColor: 'rgba(10, 6, 24, 0.42)',
    shadowColor: '#B026FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 10,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 18px rgba(176, 38, 255, 0.45)' }
      : null),
  },
  bubbleTint: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(18, 8, 40, 0.28)',
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.bodyMedium,
    letterSpacing: 0.35,
  },
  tailWrap: {
    width: 16,
    height: 10,
    marginRight: 18,
    marginTop: -1,
    alignItems: 'center',
  },
  tailWrapLeft: {
    marginRight: 0,
    marginLeft: 18,
  },
  tailWrapAbove: {
    marginTop: 0,
    marginBottom: -1,
  },
  tailBorder: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: BUBBLE_PURPLE,
  },
  tailFill: {
    position: 'absolute',
    top: -1,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(18, 10, 36, 0.92)',
  },
  tailBorderUp: {
    top: 0,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: BUBBLE_PURPLE,
  },
  tailFillUp: {
    top: 1,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    borderBottomWidth: 9,
    borderBottomColor: 'rgba(18, 10, 36, 0.92)',
  },
  nativeVideo: {
    backgroundColor: 'transparent',
    top: 0,
    left: 0,
    right: 0,
    // Taller than the window it is seen through, so nothing can uncover the
    // backdrop and the visible part is the top of the clip.
    bottom: -FLORA_VIDEO_EXTEND_Y,
  },
});
