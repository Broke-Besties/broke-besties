import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Overpass_400Regular,
  Overpass_500Medium,
  Overpass_600SemiBold,
  Overpass_700Bold,
} from '@expo-google-fonts/overpass';
import 'react-native-reanimated';
import '../global.css';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function navigationTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[scheme];
  const font = (fontFamily: string) => ({ fontFamily, fontWeight: 'normal' as const });
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.background,
      text: c.foreground,
      border: c.border,
      notification: c.destructive,
    },
    fonts: {
      regular: font('Overpass_400Regular'),
      medium: font('Overpass_500Medium'),
      bold: font('Overpass_600SemiBold'),
      heavy: font('Overpass_700Bold'),
    },
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Overpass_400Regular,
    Overpass_500Medium,
    Overpass_600SemiBold,
    Overpass_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={navigationTheme(colorScheme)}>
      <Stack screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="groups/[id]" options={{ title: 'Group' }} />
        <Stack.Screen name="debts/[id]" options={{ title: 'Debt' }} />
        <Stack.Screen name="invites" options={{ title: 'Invitations' }} />
        <Stack.Screen name="ai" options={{ title: 'AI Assistant' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
