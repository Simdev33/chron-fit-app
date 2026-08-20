import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { usePalette } from '@/components/figma/ui';
import { font, violet } from '@/constants/figma';

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;
/** Half a circle, drawn left to right over the top. */
const ARC = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${
  CX + RADIUS
} ${CY}`;
const ARC_LENGTH = Math.PI * RADIUS;

const OVER = '#F87171';

export function CalorieRing({
  consumed,
  target,
}: {
  consumed: number;
  target: number;
}) {
  const p = usePalette();

  const remaining = target - consumed;
  const over = remaining < 0;
  const fraction = target > 0 ? Math.min(consumed / target, 1) : 0;
  const colour = over ? OVER : violet[500];

  return (
    <View style={styles.wrap}>
      <View style={{ width: SIZE, height: CY + STROKE }}>
        <Svg width={SIZE} height={CY + STROKE}>
          <Path
            d={ARC}
            stroke={p.dark ? 'rgba(255,255,255,0.10)' : '#EDE9FE'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
          {fraction > 0 ? (
            // Dashing the same arc is what draws a partial one: a visible run
            // of `fraction`, then a gap long enough to hide the rest.
            <Path
              d={ARC}
              stroke={colour}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${ARC_LENGTH * fraction} ${ARC_LENGTH}`}
            />
          ) : null}
        </Svg>

        <View style={styles.centre} pointerEvents="none">
          <Text
            style={[styles.value, { color: over ? OVER : p.text }]}
            numberOfLines={1}>
            {Math.abs(remaining).toLocaleString('hu-HU')}
          </Text>
          <Text style={[styles.caption, { color: p.muted }]}>
            {over ? 'kalóriával több' : 'kalória maradt'}
          </Text>
        </View>
      </View>

      <Text style={[styles.footnote, { color: p.faint }]}>
        {consumed.toLocaleString('hu-HU')} / {target.toLocaleString('hu-HU')}{' '}
        kcal
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  centre: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: CY / 2.1,
    alignItems: 'center',
  },
  value: {
    fontFamily: font.displayX,
    fontSize: 34,
  },
  caption: {
    fontFamily: font.body,
    fontSize: 12,
    marginTop: 2,
  },
  footnote: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    marginTop: 2,
  },
});
