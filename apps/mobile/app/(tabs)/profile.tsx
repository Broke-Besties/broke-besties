import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { InfoRow } from '@/components/info-row';
import { PageHeader } from '@/components/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { SignedOut } from '@/components/signed-out';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { apiClient } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type Profile = Awaited<ReturnType<typeof apiClient.getUser>>;

const longDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

export default function ProfileScreen() {
  const { session } = useAuth();
  const colors = useColors();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (token: string) => {
    try {
      apiClient.setAuthToken(token);
      const user = await apiClient.getUser();
      setProfile(user);
      setName(user.name ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your profile');
    }
  }, []);

  useEffect(() => {
    if (session) load(session.access_token);
  }, [session, load]);

  if (!session) return <SignedOut message="Log in to see your profile." />;

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        {error ? (
          <Text className="text-center text-sm text-destructive">{error}</Text>
        ) : (
          <ActivityIndicator color={colors.mutedForeground} />
        )}
      </View>
    );
  }

  const dirty = name.trim() !== (profile.name ?? '') && name.trim() !== '';

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { user } = await apiClient.updateProfile(name.trim());
      setProfile({ ...profile, ...user });
      Alert.alert('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const logOut = () =>
    Alert.alert('Log out?', 'You can log back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/');
        },
      },
    ]);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-8">
      <PageHeader title="Profile" description="Manage your account settings." />

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Update your profile details below.</CardDescription>
        </CardHeader>
        <CardContent className="gap-4">
          <Avatar name={profile.name || profile.email} className="h-14 w-14" />
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
          <View className="gap-2">
            <Label>Name</Label>
            <Input value={name} onChangeText={setName} placeholder="Your name" editable={!saving} />
          </View>
          <View className="gap-2">
            <Label>Email</Label>
            <Input value={profile.email} editable={false} />
            <Text className="text-xs text-muted-foreground">Email cannot be changed.</Text>
          </View>
          <View className="flex-row gap-2">
            <Button onPress={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button variant="outline" onPress={() => setName(profile.name ?? '')} disabled={!dirty || saving}>
              Cancel
            </Button>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account information</CardTitle>
          <CardDescription>View your account details.</CardDescription>
        </CardHeader>
        <CardContent>
          <InfoRow label="Member since" value={longDate(profile.createdAt)} />
          <Separator />
          <InfoRow label="Last updated" value={longDate(profile.updatedAt)} />
          <Separator />
          <InfoRow label="User ID" value={profile.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log out</CardTitle>
          <CardDescription>Sign out of your account on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onPress={logOut} className="self-start">
            Log out
          </Button>
        </CardContent>
      </Card>
    </ScrollView>
  );
}
