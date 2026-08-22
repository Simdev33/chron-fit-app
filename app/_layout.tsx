import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AuthFlow } from '@/components/auth/AuthFlow';
import { WelcomeSplash } from '@/components/auth/WelcomeSplash';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { FloraSceneProvider } from '@/context/FloraSceneContext';
import { HealthLogProvider } from '@/context/HealthLogContext';
import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { TutorialProvider } from '@/context/TutorialContext';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <ProfileProvider>
          <HealthLogProvider>
            <TutorialProvider>
              <FloraSceneProvider>
                <RootLayoutNav />
              </FloraSceneProvider>
            </TutorialProvider>
          </HealthLogProvider>
        </ProfileProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const { isDark } = useAppTheme();
  const { ready, profile, updateProfile } = useProfile();
  const [introDone, setIntroDone] = useState(false);

  if (!ready) {
    return null;
  }

  // The splash asks for a name, so it belongs to a first run only. Keying it
  // on local state alone sent anyone who signed out back through it, because
  // that state starts false on every launch -- including launches that began
  // already signed in.
  const needsIntro = !introDone && !profile.name.trim();

  let content: React.ReactNode;
  if (!profile.loggedIn && needsIntro) {
    content = (
      <WelcomeSplash
        onDone={(name) => {
          updateProfile({ name });
          setIntroDone(true);
        }}
      />
    );
  } else if (!profile.loggedIn) {
    // Someone who has been here before is signing back in, not signing up.
    content = (
      <AuthFlow initialScreen={profile.name.trim() ? 'login' : 'signup'} />
    );
  } else if (!profile.onboarded) {
    content = <OnboardingFlow />;
  } else {
    content = (
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chatbot" options={{ headerShown: false }} />
      </Stack>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {content}
    </>
  );
}
