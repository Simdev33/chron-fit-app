import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { usePalette } from '@/components/figma/ui';
import { font } from '@/constants/figma';

type Point = { date: string; severity: number; crp: number };

function buildPath(values: number[], w: number, h: number, max: number) {
  const stepX = w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * stepX;
      const y = h - (v / max) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function DualLineChart({ data }: { data: readonly Point[] }) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const height = 150;
  const max = 12;
  const tickColor = p.dark ? 'rgba(255,255,255,0.35)' : 'rgba(107,81,163,0.7)';

  const severity = data.map((d) => d.severity);
  const crp = data.map((d) => d.crp);

  return (
    <View>
      <View
        style={{ height, marginLeft: 20 }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {[0, 3, 6, 9, 12].map((tick) => (
              <SvgText
                key={tick}
                x={-6}
                y={height - (tick / max) * height + 3}
                fontSize={9}
                fill={tickColor}
                textAnchor="end">
                {tick}
              </SvgText>
            ))}
            <Path
              d={buildPath(severity, width, height, max)}
              stroke="#8B5CF6"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d={buildPath(crp, width, height, max)}
              stroke="#F0ABFC"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {severity.map((v, i) => (
              <Circle
                key={`s${i}`}
                cx={(i * width) / (severity.length - 1)}
                cy={height - (v / max) * height}
                r={3}
                fill="#8B5CF6"
              />
            ))}
            {crp.map((v, i) => (
              <Circle
                key={`c${i}`}
                cx={(i * width) / (crp.length - 1)}
                cy={height - (v / max) * height}
                r={3}
                fill="#F0ABFC"
              />
            ))}
          </Svg>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 8,
          marginLeft: 20,
        }}>
        {data.map((d, i) =>
          i % 2 === 0 ? (
            <Text
              key={d.date}
              style={{ fontSize: 9, fontFamily: font.body, color: tickColor }}>
              {d.date}
            </Text>
          ) : null,
        )}
      </View>
    </View>
  );
}
