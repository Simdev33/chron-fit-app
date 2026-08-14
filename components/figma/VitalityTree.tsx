import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

// Exact geometry from the Figma prototype (390x844 viewBox).
const ROOTS: [string, number, number][] = [
  ['M195,820 C165,828 138,835 110,830', 1.5, 0.4],
  ['M195,820 C225,828 252,835 280,829', 1.5, 0.4],
  ['M190,830 C175,840 158,848 140,845', 1, 0.25],
  ['M200,830 C215,840 232,848 250,844', 1, 0.25],
];

const TRUNK =
  'M195,820 C193,790 190,755 191,718 C192,680 193,650 194,618 C195,585 195,562 195,535';

// [d, width, primary?, opacity]
const BRANCHES: [string, number, boolean, number][] = [
  ['M192,690 C172,670 148,652 118,634 C94,620 70,610 48,600', 4, true, 1],
  ['M194,690 C214,668 240,650 268,632 C294,616 318,604 342,594', 4, true, 1],
  ['M148,652 C132,638 112,628 88,616', 2.5, false, 1],
  ['M88,616 C70,604 52,594 34,586', 1.5, false, 1],
  ['M120,634 C104,620 90,606 80,592', 1.5, false, 1],
  ['M242,650 C258,636 272,620 284,604', 2.5, false, 1],
  ['M284,604 C296,590 304,574 310,558', 1.5, false, 1],
  ['M268,632 C280,618 290,604 298,590', 1.5, false, 1],
  ['M193,600 C172,578 148,560 118,544 C96,532 74,522 52,514', 3, true, 1],
  ['M196,600 C218,578 242,562 268,546 C290,532 312,522 336,514', 3, true, 1],
  ['M148,560 C132,546 114,534 94,524', 2, false, 1],
  ['M94,524 C76,514 58,506 40,500', 1.5, false, 1],
  ['M240,562 C255,548 266,532 272,516', 2, false, 1],
  ['M272,516 C278,502 282,488 282,474', 1.5, false, 1],
  ['M195,535 C193,505 190,475 188,445 C186,415 185,390 184,365', 2.5, true, 1],
  ['M187,460 C168,442 148,426 124,412 C104,402 82,394 60,388', 2.5, true, 1],
  ['M189,460 C210,442 232,426 255,412 C276,402 298,394 320,388', 2.5, true, 1],
  ['M124,412 C108,400 90,390 70,382', 1.5, false, 1],
  ['M70,382 C54,374 38,368 22,364', 1, false, 0.7],
  ['M255,412 C272,400 287,388 300,376', 1.5, false, 1],
  ['M300,376 C314,366 328,356 340,348', 1, false, 0.7],
  ['M185,400 C175,378 165,358 158,336', 1.5, false, 1],
  ['M186,400 C192,378 198,358 202,336', 1.5, false, 1],
  ['M187,400 C200,380 212,360 220,338', 1, false, 0.7],
];

// [cx, cy, r, primary?, opacity]
const LEAVES: [number, number, number, boolean, number][] = [
  [46, 598, 6, false, 1],
  [36, 605, 4, false, 0.65],
  [55, 592, 4, true, 1],
  [344, 591, 6, false, 1],
  [354, 597, 4, false, 0.65],
  [336, 584, 4, true, 1],
  [50, 512, 6, false, 1],
  [40, 519, 4, false, 0.6],
  [60, 506, 3.5, true, 1],
  [336, 512, 6, false, 1],
  [346, 518, 4, false, 0.6],
  [326, 506, 3.5, true, 1],
  [58, 386, 7, false, 1],
  [46, 392, 4.5, false, 0.65],
  [68, 380, 4.5, true, 1],
  [20, 362, 5, false, 1],
  [10, 366, 3, false, 0.5],
  [322, 386, 7, false, 1],
  [334, 392, 4.5, false, 0.65],
  [312, 380, 4.5, true, 1],
  [342, 346, 5, false, 1],
  [352, 340, 3, false, 0.5],
  [156, 334, 5, false, 1],
  [146, 328, 3.5, true, 1],
  [202, 334, 5, false, 1],
  [220, 336, 4, false, 0.65],
  [184, 320, 7, false, 1],
  [192, 310, 5, true, 1],
  [178, 308, 4, false, 0.8],
  [200, 304, 4, false, 0.6],
  [78, 380, 3.5, false, 0.6],
  [300, 376, 3.5, false, 0.6],
  [80, 590, 3, false, 0.5],
  [310, 588, 3, false, 0.5],
  [282, 472, 4, false, 0.55],
];

export function VitalityTree({ remission }: { remission: boolean }) {
  const { width, height } = useWindowDimensions();
  const n = remission ? '#8B5CF6' : '#6B7FD7';
  const i = remission ? '#C4B5FD' : '#9BAAEF';
  const glow = useRef(new Animated.Value(remission ? 0.55 : 0.25)).current;

  useEffect(() => {
    const [lo, hi] = remission ? [0.55, 0.8] : [0.25, 0.38];
    glow.setValue(lo);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: hi, duration: 2500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: lo, duration: 2500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [remission, glow]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: glow }]}>
      <Svg
        width={width}
        height={height}
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMax slice">
        <Defs>
          <RadialGradient id="rootAura" cx="50%" cy="100%" r="50%">
            <Stop offset="0%" stopColor={n} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={n} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="trunkGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <Stop offset="0%" stopColor={n} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={i} stopOpacity={1} />
          </LinearGradient>
          <RadialGradient id="midGlow" cx="50%" cy="38%" r="60%">
            <Stop
              offset="0%"
              stopColor={remission ? '#8B5CF6' : '#6B7FD7'}
              stopOpacity={remission ? 0.18 : 0.12}
            />
            <Stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Ellipse cx={195} cy={840} rx={140} ry={35} fill="url(#rootAura)" />

        {ROOTS.map(([d, w, op], idx) => (
          <Path
            key={`root-${idx}`}
            d={d}
            stroke={n}
            strokeWidth={w}
            strokeLinecap="round"
            strokeOpacity={op}
            fill="none"
          />
        ))}

        {/* soft glow twin behind the trunk */}
        <Path
          d={TRUNK}
          stroke={n}
          strokeWidth={16}
          strokeLinecap="round"
          strokeOpacity={0.18}
          fill="none"
        />
        <Path
          d={TRUNK}
          stroke="url(#trunkGrad)"
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />

        {BRANCHES.map(([d, w, primary, op], idx) => (
          <React.Fragment key={`br-${idx}`}>
            <Path
              d={d}
              stroke={primary ? n : i}
              strokeWidth={w * 2.4}
              strokeLinecap="round"
              strokeOpacity={0.12 * op}
              fill="none"
            />
            <Path
              d={d}
              stroke={primary ? n : i}
              strokeWidth={w}
              strokeLinecap="round"
              strokeOpacity={op}
              fill="none"
            />
          </React.Fragment>
        ))}

        {LEAVES.map(([cx, cy, r, primary, op], idx) => (
          <React.Fragment key={`leaf-${idx}`}>
            <Circle
              cx={cx}
              cy={cy}
              r={r * 2.2}
              fill={primary ? n : i}
              fillOpacity={0.14 * op}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              fill={primary ? n : i}
              fillOpacity={op}
            />
          </React.Fragment>
        ))}

        <Ellipse cx={195} cy={320} rx={260} ry={280} fill="url(#midGlow)" />
      </Svg>
    </Animated.View>
  );
}
