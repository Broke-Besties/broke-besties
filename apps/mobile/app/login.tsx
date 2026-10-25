import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { Brand } from '@/components/brand';
import { GoogleIcon } from '@/components/google-icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useColors } from '@/hooks/use-colors';
import { signInWithGoogle } from '@/lib/google-sign-in';
import { supabase } from '@/lib/supabase';

// Same copy as the web's auth form.
const COPY = {
  login: {
    title: 'Welcome back',
    description: 'Log in to manage groups, invites, and debts.',
    submit: 'Log in',
    footer: "Don't have an account?",
    switchLabel: 'Sign up',
  },
  signup: {
    title: 'Create your account',
    description: 'Start creating groups and tracking debts in minutes.',
    submit: 'Create account',
    footer: 'Already have an account?',
    switchLabel: 'Log in',
  },
};

export default function LoginScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'login' | 'signup'>(params.mode === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const copy = COPY[mode];

  async function handleSubmit() {
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading('email');
    setError('');
    setNotice('');
    try {
      const { data, error } =
        mode === 'login'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.replace('/');
      } else {
        setNotice(`Check ${email} to confirm your account.`);
      }
    } catch {
      setError('Could not connect to the server');
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    setLoading('google');
    setError('');
    setNotice('');
    try {
      if (await signInWithGoogle()) router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="flex-grow justify-center gap-6 p-6" keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} className="absolute left-4 top-14 h-10 w-10 items-center justify-center">
          <ArrowLeft color={colors.foreground} size={20} />
        </Pressable>

        <View className="items-center">
          <Brand />
        </View>

        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            {error ? (
              <View className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <Text className="text-sm text-destructive">{error}</Text>
              </View>
            ) : null}
            {notice ? (
              <View className="rounded-md border border-border bg-muted p-3">
                <Text className="text-sm">{notice}</Text>
              </View>
            ) : null}

            <Button variant="outline" onPress={handleGoogle} disabled={loading !== null}>
              {loading === 'google' ? <ActivityIndicator size="small" color={colors.foreground} /> : <GoogleIcon />}
              <Text>Continue with Google</Text>
            </Button>

            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-border" />
              <Text className="text-sm text-muted-foreground">Or continue with</Text>
              <View className="h-px flex-1 bg-border" />
            </View>

            <View className="gap-2">
              <Label>Email</Label>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={loading === null}
              />
            </View>
            <View className="gap-2">
              <Label>Password</Label>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                editable={loading === null}
                onSubmitEditing={handleSubmit}
              />
            </View>

            <Button onPress={handleSubmit} disabled={loading !== null} className="mt-2">
              {loading === 'email' ? 'Please wait…' : copy.submit}
            </Button>

            <View className="flex-row justify-center gap-1">
              <Text className="text-sm text-muted-foreground">{copy.footer}</Text>
              <Pressable
                onPress={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError('');
                  setNotice('');
                }}
              >
                <Text className="text-sm font-medium underline">{copy.switchLabel}</Text>
              </Pressable>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
