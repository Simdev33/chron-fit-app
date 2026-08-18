import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send, Sparkles } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { BackgroundWrapper } from '@/components/BackgroundWrapper';
import { useKeyboardHeight, usePalette } from '@/components/figma/ui';
import { blue, font, violet } from '@/constants/figma';
import type { FloraChatMessage } from '@/types/floraChat';
import { requestFloraReply } from '@/utils/floraChatApi';

const INITIAL: FloraChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    text: 'Szia! Flóra vagyok, a CrohnSync támogató egészség-asszisztense. Segíthetek az általános információk megértésében és a kérdéseid átgondolásában. Miben segíthetek?',
  },
];

const QUICK = [
  'Mit ehetek ma?',
  'Magyarázd el a CRP-eredményem',
  'Normális a fájdalomszintem?',
  'Javasolj kíméletes edzést',
];

export function ChatbotView({
  onClose,
  remission,
}: {
  onClose: () => void;
  remission: boolean;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [messages, setMessages] = useState<FloraChatMessage[]>(INITIAL);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: FloraChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: trimmed,
    };
    const conversation = [...messages, userMessage];

    setMessages(conversation);
    setInput('');
    setErrorText(null);
    setLoading(true);

    try {
      const reply = await requestFloraReply(conversation);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-flora`,
          role: 'assistant',
          text: reply,
        },
      ]);
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'Flóra most nem tudott válaszolni. Próbáld újra.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <BackgroundWrapper variant="health">
      <KeyboardAvoidingView
        style={[styles.root, { paddingBottom: keyboardHeight }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 8,
              borderBottomColor: p.divider,
              backgroundColor: p.dark
                ? 'rgba(10,5,24,0.72)'
                : 'rgba(255,255,255,0.72)',
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
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled">
          {messages.map((m) => (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                gap: 8,
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
              {m.role === 'assistant' ? (
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
          {loading ? (
            <View style={styles.loadingRow}>
              <LinearGradient
                colors={[violet[500], violet[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.aiAvatar}>
                <Sparkles size={12} color="#fff" />
              </LinearGradient>
              <View
                style={[
                  styles.loadingBubble,
                  {
                    backgroundColor: p.dark
                      ? 'rgba(255,255,255,0.08)'
                      : '#FFFFFF',
                    borderColor: p.dark
                      ? 'rgba(255,255,255,0.1)'
                      : '#F3E8FF',
                  },
                ]}>
                <ActivityIndicator size="small" color={violet[400]} />
                <Text style={[styles.loadingText, { color: p.muted }]}>
                  Flóra gondolkodik…
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: p.divider,
            backgroundColor: p.dark
              ? 'rgba(10,5,24,0.64)'
              : 'rgba(255,255,255,0.66)',
          }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}>
            {QUICK.map((q) => (
              <Pressable
                key={q}
                disabled={loading}
                onPress={() => void send(q)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  opacity: loading ? 0.45 : 1,
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
              backgroundColor: p.dark
                ? 'rgba(10,5,24,0.78)'
                : 'rgba(255,255,255,0.78)',
            },
          ]}>
          {errorText ? (
            <Text
              accessibilityRole="alert"
              style={[styles.errorText, { color: p.dark ? '#FCA5A5' : '#B91C1C' }]}>
              {errorText}
            </Text>
          ) : null}
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
              accessibilityLabel="Üzenet Flórának"
              editable={!loading}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => void send(input)}
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
            <Pressable
              accessibilityLabel="Üzenet küldése"
              accessibilityRole="button"
              disabled={loading || !input.trim()}
              onPress={() => void send(input)}
              style={{ opacity: loading || !input.trim() ? 0.45 : 1 }}>
              <LinearGradient
                colors={[violet[600], violet[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.smallBtn}>
                <Send size={14} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
          <Text style={[styles.disclaimer, { color: p.muted }]}>
            Flóra általános tájékoztatást ad, és nem helyettesíti az orvost.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}

export function AIChatModal({
  visible,
  onClose,
  remission,
}: {
  visible: boolean;
  onClose: () => void;
  remission: boolean;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="fullScreen">
      <ChatbotView onClose={onClose} remission={remission} />
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  loadingBubble: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  loadingText: {
    fontFamily: font.body,
    fontSize: 12,
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
  errorText: {
    fontFamily: font.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
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
  disclaimer: {
    marginTop: 7,
    textAlign: 'center',
    fontFamily: font.body,
    fontSize: 9,
    lineHeight: 13,
  },
});
