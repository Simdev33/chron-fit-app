import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Mic, Send, Sparkles } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardHeight, usePalette } from '@/components/figma/ui';
import { blue, font, violet } from '@/constants/figma';

type Msg = { id: string; role: 'ai' | 'user'; text: string };

const INITIAL: Msg[] = [
  {
    id: '1',
    role: 'ai',
    text: 'Jó reggelt! Erős a sorozatod — 6 nap fellángolás nélkül.\n\nA legutóbbi CRP-értéked 1,8 mg/L volt, bőven a normál tartományban. Az alvási adataid és a tegnapi étkezési naplód alapján a mai nap alkalmas könnyű mozgásra. Hogy érzed magad?',
  },
];

const QUICK = [
  'Mit ehetek ma?',
  'Magyarázd el a CRP-eredményem',
  'Normális a fájdalomszintem?',
  'Javasolj kíméletes edzést',
];

const CANNED_REPLY =
  'Jó kérdés! A legutóbbi naplóid és a jelenlegi remissziós állapotod alapján ma az alacsony rosttartalmú, könnyen emészthető ételeket javaslom. A sült lazac fehér rizzsel kiváló választás lenne. Szeretnél teljes étrendtervet?';

export function AIChatModal({
  visible,
  onClose,
  remission,
}: {
  visible: boolean;
  onClose: () => void;
  remission: boolean;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}u`, role: 'user', text },
      { id: `${Date.now()}a`, role: 'ai', text: CANNED_REPLY },
    ]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="fullScreen">
      <KeyboardAvoidingView
        style={[
          styles.root,
          { backgroundColor: p.bg, paddingBottom: keyboardHeight },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 8,
              borderBottomColor: p.divider,
            },
          ]}>
          <Pressable
            onPress={onClose}
            style={[styles.iconBtn, { backgroundColor: p.chipBg }]}>
            <ChevronLeft size={18} color={p.muted} />
          </Pressable>
          <LinearGradient
            colors={[violet[500], violet[700]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBtn}>
            <Sparkles size={16} color="#fff" />
          </LinearGradient>
          <View>
            <Text
              style={{ fontFamily: font.display, fontSize: 14, color: p.text }}>
              AI egészség-asszisztens
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: remission ? violet[400] : blue[400],
                }}
              />
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: font.bodySemi,
                  color: violet[400],
                }}>
                {remission ? 'Remisszió mód' : 'Fellángolás mód'}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.msgList}
          keyboardShouldPersistTaps="handled">
          {messages.map((m) => (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                gap: 8,
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
              {m.role === 'ai' ? (
                <LinearGradient
                  colors={[violet[500], violet[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.aiAvatar}>
                  <Sparkles size={12} color="#fff" />
                </LinearGradient>
              ) : null}
              {m.role === 'user' ? (
                <LinearGradient
                  colors={[violet[600], violet[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubble, { borderTopRightRadius: 4 }]}>
                  <Text style={[styles.bubbleText, { color: '#fff' }]}>
                    {m.text}
                  </Text>
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.bubble,
                    {
                      borderTopLeftRadius: 4,
                      backgroundColor: p.dark
                        ? 'rgba(255,255,255,0.08)'
                        : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: p.dark
                        ? 'rgba(255,255,255,0.1)'
                        : '#F3E8FF',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.bubbleText,
                      {
                        color: p.dark ? 'rgba(255,255,255,0.9)' : '#1A0D35',
                      },
                    ]}>
                    {m.text}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={{ borderTopWidth: 1, borderTopColor: p.divider }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}>
            {QUICK.map((q) => (
              <Pressable
                key={q}
                onPress={() => send(q)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: p.dark ? 'rgba(139,92,246,0.3)' : '#DDD6FE',
                  backgroundColor: p.dark
                    ? 'rgba(139,92,246,0.1)'
                    : '#F5F3FF',
                }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: font.bodyMedium,
                    color: p.dark ? violet[300] : violet[600],
                  }}>
                  {q}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View
          style={[
            styles.inputRow,
            {
              borderTopColor: p.divider,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}>
          <View
            style={[
              styles.inputPill,
              {
                backgroundColor: p.dark
                  ? 'rgba(255,255,255,0.08)'
                  : '#FFFFFF',
                borderColor: p.dark ? 'rgba(255,255,255,0.1)' : '#F3E8FF',
              },
            ]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              placeholder="Kérdezz az egészségedről…"
              placeholderTextColor={p.placeholder}
              style={{
                flex: 1,
                fontSize: 14,
                fontFamily: font.body,
                color: p.text,
                paddingVertical: 0,
              }}
            />
            <Pressable style={[styles.smallBtn, { backgroundColor: p.chipBg }]}>
              <Mic size={15} color={p.muted} />
            </Pressable>
            <Pressable onPress={() => send(input)}>
              <LinearGradient
                colors={[violet[600], violet[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.smallBtn}>
                <Send size={14} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: font.body,
  },
  quickRow: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  inputRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
