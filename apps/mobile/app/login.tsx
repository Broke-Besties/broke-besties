import { useState } from 'react';
import { Alert, Platform, Pressable, View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter email and password');
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        Alert.alert('Error', error.message);
        return;
      }

      router.replace('/');
    } catch (error) {
      const errorMessage = 'Could not connect to server';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!email || !password) {
      setError('Please enter email and password');
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert('Success', `Check your email (${email}) to confirm your account!`);
      router.replace('/');
    } catch (error) {
      const errorMessage = 'Could not connect to server';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-6">
      <View className="flex-1 justify-center gap-8">
        {/* Back Button */}
        <Pressable onPress={() => router.back()} className="absolute top-[60px] left-0">
          <ThemedText className="text-sm text-primary">← Back</ThemedText>
        </Pressable>

        {/* Header */}
        <View className="gap-3 mt-20">
          <ThemedText type="title" className="text-[32px] leading-[38px] tracking-tight">
            Welcome back
          </ThemedText>
          <ThemedText className="text-base leading-6 text-muted-foreground">
            Sign in to manage your shared expenses
          </ThemedText>
        </View>

        {/* Login Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            {/* Error Message */}
            {error && (
              <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <ThemedText className="text-sm text-destructive">{error}</ThemedText>
              </View>
            )}

            {/* Email Field */}
            <View className="gap-2">
              <Label>Email</Label>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* Password Field */}
            <View className="gap-2">
              <Label>Password</Label>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry
                editable={!loading}
              />
            </View>

            {/* Action Buttons */}
            <View className="gap-3 mt-2">
              <Button onPress={handleLogin} disabled={loading}>
                <ThemedText className="text-base font-semibold">
                  {loading ? 'Loading...' : 'Log in'}
                </ThemedText>
              </Button>
              <Button variant="outline" onPress={handleSignup} disabled={loading}>
                <ThemedText className="text-base font-semibold">
                  Create account
                </ThemedText>
              </Button>
            </View>
          </CardContent>
        </Card>

        {/* Alternative Options */}
        <View className="items-center gap-2">
          <ThemedText className="text-xs text-muted-foreground text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}
