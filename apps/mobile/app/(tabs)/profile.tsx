import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ProfileScreen() {
  const { user, session, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (user) {
      // Load name from user metadata
      setName(user.user_metadata?.name || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { name: name.trim() },
      });

      if (updateError) {
        setError(updateError.message);
        Alert.alert('Error', updateError.message);
        return;
      }

      setSuccess('Profile updated successfully!');
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const toggleTheme = async () => {
    // Theme toggle functionality could be implemented here
    // For now, it uses system preference
    Alert.alert('Theme', 'Theme follows your system preference');
  };

  if (!isAuthenticated || !user) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-semibold text-foreground mb-4">
          Please log in to view your profile
        </Text>
        <Button onPress={() => router.push('/login')}>
          <Text>Go to Login</Text>
        </Button>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-6">
      {/* Header */}
      <View className="mb-6">
        <Text className="text-3xl font-semibold text-foreground mb-2">
          Profile
        </Text>
        <Text className="text-sm text-muted-foreground">
          Manage your account settings.
        </Text>
      </View>

      {/* Personal Information Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your profile details below.</CardDescription>
        </CardHeader>
        <CardContent className="gap-4">
          {/* Error Message */}
          {error && (
            <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          )}

          {/* Success Message */}
          {success && (
            <View className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <Text className="text-sm text-emerald-700">{success}</Text>
            </View>
          )}

          {/* Name Field */}
          <View className="gap-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              editable={!loading}
            />
          </View>

          {/* Email Field (Disabled) */}
          <View className="gap-2">
            <Label>Email</Label>
            <Input
              value={user.email || ''}
              editable={false}
              className="bg-muted"
            />
            <Text className="text-xs text-muted-foreground">
              Email cannot be changed
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mt-2">
            <View className="flex-1">
              <Button onPress={handleSaveProfile} disabled={loading}>
                <Text>{loading ? 'Saving...' : 'Save Changes'}</Text>
              </Button>
            </View>
            <View className="flex-1">
              <Button
                variant="outline"
                onPress={() => router.push('/')}
                disabled={loading}
              >
                <Text>Cancel</Text>
              </Button>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Account Information Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>View your account details.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {/* User ID */}
          <View className="flex-row items-center justify-between py-3">
            <Text className="text-sm text-muted-foreground">User ID</Text>
            <Text className="text-sm font-medium text-foreground truncate max-w-[60%]">
              {user.id}
            </Text>
          </View>
          <Separator />

          {/* Member Since */}
          <View className="flex-row items-center justify-between py-3">
            <Text className="text-sm text-muted-foreground">Member Since</Text>
            <Text className="text-sm font-medium text-foreground">
              {user.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : 'N/A'}
            </Text>
          </View>
          <Separator />

          {/* Last Sign In */}
          <View className="flex-row items-center justify-between py-3">
            <Text className="text-sm text-muted-foreground">Last Sign In</Text>
            <Text className="text-sm font-medium text-foreground">
              {user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleDateString()
                : 'N/A'}
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* Settings Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your app preferences.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {/* Theme Toggle */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">Theme</Text>
              <Text className="text-xs text-muted-foreground mt-1">
                Current: {colorScheme === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </View>
            <Button variant="outline" size="sm" onPress={toggleTheme}>
              <Text className="text-xs">Change</Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      {/* Logout Button */}
      <Button variant="destructive" onPress={handleLogout}>
        <Text>Logout</Text>
      </Button>
    </ScrollView>
  );
}
