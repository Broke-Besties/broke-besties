import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { Group } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export default function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);
  const { isAuthenticated, session } = useAuth();

  useEffect(() => {
    if (isAuthenticated && session) {
      // Set the auth token from Supabase session
      apiClient.setAuthToken(session.access_token);
      loadGroups();
      loadInviteCount();
    }
  }, [isAuthenticated, session]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getGroups();
      setGroups(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const loadInviteCount = async () => {
    try {
      const invites = await apiClient.getInvites();
      setInviteCount(invites.length);
    } catch (err) {
      // Silently fail for invite count
      console.error('Failed to load invite count:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadGroups(), loadInviteCount()]);
    setRefreshing(false);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setCreating(true);
    setError('');

    try {
      await apiClient.createGroup(newGroupName.trim());
      setShowCreateModal(false);
      setNewGroupName('');
      await loadGroups();
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
      Alert.alert('Error', err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleGroupPress = (groupId: number) => {
    router.push(`/groups/${groupId}`);
  };

  if (!isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-semibold text-foreground mb-4">
          Please log in to view groups
        </Text>
        <Button onPress={() => router.push('/login')}>
          <Text>Go to Login</Text>
        </Button>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Section */}
        <View className="mb-6">
          <Text className="text-3xl font-semibold text-foreground mb-2">
            My groups
          </Text>
          <Text className="text-sm text-muted-foreground">
            Manage your groups and invitations.
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="flex-row flex-wrap gap-2 mb-6">
          <Button variant="secondary" onPress={() => router.push('/')}>
            <Text>Dashboard</Text>
          </Button>
          <View className="relative">
            <Button variant="secondary" onPress={() => router.push('/invites')}>
              <Text>Invites</Text>
            </Button>
            {inviteCount > 0 && (
              <View className="absolute -top-2 -right-2">
                <Badge variant="destructive">
                  <Text className="text-xs">{inviteCount}</Text>
                </Badge>
              </View>
            )}
          </View>
          <Button onPress={() => setShowCreateModal(true)}>
            <Text>Create group</Text>
          </Button>
        </View>

        {/* Error Message */}
        {error && (
          <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 mb-4">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        )}

        {/* Loading State */}
        {loading && (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" />
            <Text className="text-sm text-muted-foreground mt-2">Loading groups...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && groups.length === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No groups yet</CardTitle>
              <CardDescription>
                You haven't joined any groups. Create one to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onPress={() => setShowCreateModal(true)}>
                <Text>Create your first group</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Groups Grid */}
        {!loading && groups.length > 0 && (
          <View className="gap-4">
            {groups.map((group) => (
              <Pressable key={group.id} onPress={() => handleGroupPress(group.id)}>
                <Card className="active:opacity-70">
                  <CardHeader>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <CardDescription>
                      {group._count?.members || 0}{' '}
                      {(group._count?.members || 0) === 1 ? 'member' : 'members'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Text className="text-sm text-muted-foreground">
                      Created {new Date(group.createdAt).toLocaleDateString()}
                    </Text>
                  </CardContent>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Group Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new group</DialogTitle>
            </DialogHeader>
            <View className="gap-4 px-6 pb-6">
              <View className="gap-2">
                <Label>Group name</Label>
                <Input
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="e.g. Roommates"
                  autoFocus
                />
              </View>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewGroupName('');
                    setError('');
                  }}
                  disabled={creating}
                >
                  <Text>Cancel</Text>
                </Button>
                <Button onPress={handleCreateGroup} disabled={creating}>
                  <Text>{creating ? 'Creating...' : 'Create group'}</Text>
                </Button>
              </DialogFooter>
            </View>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
