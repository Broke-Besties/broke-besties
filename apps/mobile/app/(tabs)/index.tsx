import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import Constants from 'expo-constants';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { styles } from '@/styles/login';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:3000';

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
      style={[
        styles.button,
        {
          backgroundColor: isPrimary ? tint : background,
          borderColor: isPrimary ? tint : text,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <ThemedText style={[styles.buttonText, { color: isPrimary ? background : text }]}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

export default function HomeScreen() {
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
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <ThemedText type="title" style={styles.headline}>
            Welcome back
          </ThemedText>
          <ThemedText style={[styles.subheadline, { color: iconColor }]}>
            Sign in to manage your shared expenses
          </ThemedText>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { borderColor, color: textColor }]}
            placeholder="Email"
            placeholderTextColor={iconColor}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.input, { borderColor, color: textColor }]}
            placeholder="Password"
            placeholderTextColor={iconColor}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <View style={styles.buttons}>
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

