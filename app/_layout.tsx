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
import 'react-native-reanimated';

import { AuthFlow } from '@/components/auth/AuthFlow';
import { WelcomeSplash } from '@/components/auth/WelcomeSplash';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { HealthLogProvider, useHealthLog } from '@/context/HealthLogContext';
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
    <AppThemeProvider>
      <ProfileProvider>
        <HealthLogProvider>
          <TutorialProvider>
            <ProfileMedsSync />
            <RootLayoutNav />
          </TutorialProvider>
        </HealthLogProvider>
      </ProfileProvider>
    </AppThemeProvider>
  );
}

/** A profil felírt gyógyszerei azonnal megjelenjenek a bevételi listában. */
function ProfileMedsSync() {
  const { ready: profileReady, profile } = useProfile();
  const { ready: logReady, syncMedicationsFromProfile } = useHealthLog();

  useEffect(() => {
    if (!profileReady || !logReady) return;
    syncMedicationsFromProfile(
      profile.prescribedMeds,
      profile.noPrescribedMeds,
    );
  }, [
    profileReady,
    logReady,
    profile.prescribedMeds,
    profile.noPrescribedMeds,
    syncMedicationsFromProfile,
  ]);

  return null;
}

function RootLayoutNav() {
  const { isDark } = useAppTheme();
  const { ready, profile } = useProfile();
  const [splashDone, setSplashDone] = useState(false);

  if (!ready) {
    return null;
  }

  let content: React.ReactNode;
  if (!splashDone) {
    content = <WelcomeSplash onDone={() => setSplashDone(true)} />;
  } else if (!profile.loggedIn) {
    content = <AuthFlow />;
  } else if (!profile.onboarded) {
    content = <OnboardingFlow />;
  } else {
    content = (
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
