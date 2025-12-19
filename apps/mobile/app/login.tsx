import { useState } from 'react';
import { Alert, Platform, Pressable, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl;

type ButtonProps = {
  children: string;
  variant?: 'primary' | 'outline';
  onPress?: () => void;
  disabled?: boolean;
};

function Button({ children, variant = 'primary', onPress, disabled }: ButtonProps) {
  const tint = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');

  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="items-center px-5 py-3.5 rounded-[10px] border"
      style={{
        backgroundColor: isPrimary ? tint : background,
        borderColor: isPrimary ? tint : text,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <ThemedText className="text-base font-semibold" style={{ color: isPrimary ? background : text }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

export default function LoginScreen() {
  const iconColor = useThemeColor({}, 'icon');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    if (!API_BASE_URL) {
      Alert.alert(
        'Error',
        'API base URL is not configured. Set API_BASE_URL (or EXPO_PUBLIC_API_BASE_URL) in apps/mobile/.env and restart Expo.'
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Login failed');
        return;
      }

      Alert.alert('Success', `Welcome back, ${data.user.email}!`);
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    if (!API_BASE_URL) {
      Alert.alert(
        'Error',
        'API base URL is not configured. Set API_BASE_URL (or EXPO_PUBLIC_API_BASE_URL) in apps/mobile/.env and restart Expo.'
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Signup failed');
        return;
      }

      Alert.alert('Success', `Check your email (${data.user.email}) to confirm your account!`);
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView className="flex-1">
      <View className="flex-1 p-6 justify-center gap-8">
        <Pressable onPress={() => router.back()} className="absolute top-[60px] left-6">
          <ThemedText style={{ color: iconColor }}>← Back</ThemedText>
        </Pressable>

        <View className="gap-3">
          <ThemedText type="title" className="text-[32px] leading-[38px] tracking-tight">
            Welcome back
          </ThemedText>
          <ThemedText className="text-base leading-6" style={{ color: iconColor }}>
            Sign in to manage your shared expenses
          </ThemedText>
        </View>

        <View className="gap-3">
          <TextInput
            className="border rounded-[10px] px-4"
            style={{
              borderColor,
              color: textColor,
              height: 52,
              fontSize: 16,
              lineHeight: 20,
              paddingVertical: 0,
              ...(Platform.OS === 'android'
                ? { textAlignVertical: 'center' as const, includeFontPadding: false }
                : null),
            }}
            placeholder="Email"
            placeholderTextColor={iconColor}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            className="border rounded-[10px] px-4"
            style={{
              borderColor,
              color: textColor,
              height: 52,
              fontSize: 16,
              lineHeight: 20,
              paddingVertical: 0,
              ...(Platform.OS === 'android'
                ? { textAlignVertical: 'center' as const, includeFontPadding: false }
                : null),
            }}
            placeholder="Password"
            placeholderTextColor={iconColor}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <View className="gap-3 mt-1">
            <Button onPress={handleLogin} disabled={loading}>
              {loading ? 'Loading...' : 'Log in'}
            </Button>
            <Button variant="outline" onPress={handleSignup} disabled={loading}>
              Create account
            </Button>
          </View>
        </View>
      </View>
    </ThemedView>
  );
}
