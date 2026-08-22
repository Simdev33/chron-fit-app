import {
  login,
  requestSignupCode,
  verifySignupCode,
} from '@/utils/authApi';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePalette } from '@/components/figma/ui';
import { VitalityTree } from '@/components/figma/VitalityTree';
import { font, violet } from '@/constants/figma';
import { useProfile } from '@/context/ProfileContext';

type Screen = 'welcome' | 'login' | 'signup' | 'code';

function isValidEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

export function AuthFlow({
  initialScreen = 'welcome',
}: {
  initialScreen?: Screen;
}) {
  const p = usePalette();
  const { signIn, signUp } = useProfile();

  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const switchTo = (next: Screen) => {
    setScreen(next);
    setError(null);
    setNotice(null);
    setCode('');
    // The password is dropped on every move between screens rather than being
    // left in state where it is no longer needed.
    if (next !== 'code') setPassword('');
  };

  const validate = (): boolean => {
    if (!isValidEmail(email)) {
      setError('Adj meg egy érvényes email címet.');
      return false;
    }
    if (password.length < 8) {
      setError('A jelszónak legalább 8 karakter hosszúnak kell lennie.');
      return false;
    }
    setError(null);
    return true;
  };

  const submit = async () => {
    if (!validate() || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (screen === 'login') {
        const session = await login(email.trim(), password);
        signIn(session.email, session.token);
      } else {
        await requestSignupCode(email.trim(), password);
        setScreen('code');
        setNotice(`Elküldtük a kódot ide: ${email.trim()}`);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'A művelet nem sikerült.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const session = await verifySignupCode(email.trim(), code);
      // The password is only needed until the account exists.
      setPassword('');
      signUp(session.email, session.token);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'A megerősítés nem sikerült.',
      );
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestSignupCode(email.trim(), password);
      setNotice('Új kódot küldtünk.');
      setCode('');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Nem sikerült új kódot küldeni.',
      );
    } finally {
      setBusy(false);
    }
  };

  const inputWrapStyle = [
    styles.inputWrap,
    {
      backgroundColor: p.dark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
      borderColor: p.fieldBorder,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <VitalityTree remission />
      <SafeAreaView style={{ flex: 1 }}>
        {screen === 'welcome' ? (
          <View style={styles.welcomeWrap}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <LinearGradient
                colors={[violet[400], violet[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logo}>
                <Sparkles size={36} color="#fff" />
              </LinearGradient>
              <Text style={[styles.brand, { color: p.text }]}>CrohnFit</Text>
              <Text
                style={[styles.tagline, { color: p.muted }]}>
                Étrend, mozgás és gyógyszerek — egy helyen,{'\n'}az IBD-hez
                igazítva.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <Pressable
                onPress={() => switchTo('signup')}
                style={({ pressed }) => [
                  { borderRadius: 999, overflow: 'hidden' },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}>
                <LinearGradient
                  colors={[violet[600], '#9333EA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}>
                  <Text style={styles.primaryLabel}>Regisztráció</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={() => switchTo('login')}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: p.dark
                      ? 'rgba(255,255,255,0.08)'
                      : '#FFFFFF',
                    borderColor: p.dark
                      ? 'rgba(255,255,255,0.15)'
                      : '#E9D5FF',
                  },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}>
                <Text
                  style={{
                    fontFamily: font.display,
                    fontSize: 16,
                    color: p.text,
                  }}>
                  Bejelentkezés
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={styles.formWrap}
              keyboardShouldPersistTaps="handled">
              <Pressable
                onPress={() => switchTo('welcome')}
                style={({ pressed }) => [
                  styles.backBtn,
                  { backgroundColor: p.chipBg },
                  pressed && { transform: [{ scale: 0.9 }] },
                ]}>
                <ChevronLeft size={18} color={p.muted} />
              </Pressable>

              <Text style={[styles.formTitle, { color: p.text }]}>
                {screen === 'login'
                  ? 'Üdv újra!'
                  : screen === 'code'
                    ? 'Írd be a kódot'
                    : 'Fiók létrehozása'}
              </Text>
              <Text style={[styles.formSub, { color: p.muted }]}>
                {screen === 'login'
                  ? 'Jelentkezz be a folytatáshoz.'
                  : screen === 'code'
                    ? 'Küldtünk egy hat számjegyű kódot emailben. A kód 10 percig érvényes.'
                    : 'Csak egy email cím és egy jelszó kell hozzá.'}
              </Text>

              {screen === 'code' ? (
                <View style={{ gap: 12, marginTop: 24 }}>
                  {notice ? (
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: font.bodyMedium,
                        color: p.muted,
                      }}>
                      {notice}
                    </Text>
                  ) : null}

                  <TextInput
                    value={code}
                    onChangeText={(value) =>
                      setCode(value.replace(/\D/g, '').slice(0, 6))
                    }
                    editable={!busy}
                    keyboardType="number-pad"
                    autoFocus
                    maxLength={6}
                    placeholder="––––––"
                    placeholderTextColor={p.placeholder}
                    style={[
                      styles.codeInput,
                      {
                        color: p.text,
                        backgroundColor: p.dark
                          ? 'rgba(255,255,255,0.08)'
                          : '#FFFFFF',
                        borderColor: p.fieldBorder,
                      },
                    ]}
                  />

                  {error ? (
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: font.bodyMedium,
                        color: '#F87171',
                      }}>
                      {error}
                    </Text>
                  ) : null}

                  <Pressable
                    onPress={submitCode}
                    disabled={busy || code.length !== 6}
                    style={({ pressed }) => [
                      { borderRadius: 999, overflow: 'hidden', marginTop: 8 },
                      pressed && { transform: [{ scale: 0.97 }] },
                    ]}>
                    <LinearGradient
                      colors={[violet[600], '#9333EA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.primaryBtn,
                        (busy || code.length !== 6) && { opacity: 0.5 },
                      ]}>
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryLabel}>Megerősítés</Text>
                      )}
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    onPress={resend}
                    disabled={busy}
                    style={{ alignSelf: 'center', padding: 8 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: font.bodyMedium,
                        color: p.muted,
                      }}>
                      Nem jött meg? <Text style={{ color: violet[400] }}>Új kód kérése</Text>
                    </Text>
                  </Pressable>
                </View>
              ) : (

              <View style={{ gap: 12, marginTop: 24 }}>
                <View style={inputWrapStyle}>
                  <Mail size={16} color={p.muted} />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email cím"
                    placeholderTextColor={p.placeholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    style={[styles.input, { color: p.text }]}
                  />
                </View>
                <View style={inputWrapStyle}>
                  <Lock size={16} color={p.muted} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Jelszó (min. 8 karakter)"
                    placeholderTextColor={p.placeholder}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={[styles.input, { color: p.text }]}
                  />
                  <Pressable
                    onPress={() => setShowPassword((s) => !s)}
                    hitSlop={8}>
                    {showPassword ? (
                      <EyeOff size={16} color={p.muted} />
                    ) : (
                      <Eye size={16} color={p.muted} />
                    )}
                  </Pressable>
                </View>

                {screen === 'signup' ? (
                  <View style={styles.pwHintRow}>
                    <View
                      style={[
                        styles.pwDot,
                        {
                          backgroundColor:
                            password.length >= 8 ? '#34D399' : p.faint,
                        },
                      ]}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: font.body,
                        color: password.length >= 8 ? '#34D399' : p.muted,
                      }}>
                      Legalább 8 karakter ({password.length}/8)
                    </Text>
                  </View>
                ) : null}

                {error ? (
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: font.bodyMedium,
                      color: '#F87171',
                    }}>
                    {error}
                  </Text>
                ) : null}

                <Pressable
                  onPress={submit}
                  style={({ pressed }) => [
                    { borderRadius: 999, overflow: 'hidden', marginTop: 8 },
                    pressed && { transform: [{ scale: 0.97 }] },
                  ]}>
                  <LinearGradient
                    colors={[violet[600], '#9333EA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtn}>
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryLabel}>
                        {screen === 'login' ? 'Bejelentkezés' : 'Regisztráció'}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={() =>
                    switchTo(screen === 'login' ? 'signup' : 'login')
                  }
                  style={{ alignSelf: 'center', marginTop: 8, padding: 8 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: font.bodyMedium,
                      color: p.muted,
                    }}>
                    {screen === 'login' ? (
                      <>
                        Nincs még fiókod?{' '}
                        <Text
                          style={{
                            color: violet[400],
                            fontFamily: font.bodySemi,
                          }}>
                          Regisztrálj
                        </Text>
                      </>
                    ) : (
                      <>
                        Van már fiókod?{' '}
                        <Text
                          style={{
                            color: violet[400],
                            fontFamily: font.bodySemi,
                          }}>
                          Jelentkezz be
                        </Text>
                      </>
                    )}
                  </Text>
                </Pressable>
              </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeWrap: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 40,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  brand: {
    fontFamily: font.displayX,
    fontSize: 34,
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 12,
    fontFamily: font.displayX,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: '#fff',
    fontSize: 16,
    fontFamily: font.display,
  },
  secondaryBtn: {
    height: 54,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formWrap: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontFamily: font.displayX,
    fontSize: 28,
  },
  formSub: {
    fontFamily: font.body,
    fontSize: 14,
    marginTop: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: font.body,
  },
  pwHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pwDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
});
