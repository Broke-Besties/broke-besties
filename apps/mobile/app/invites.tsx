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
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { Invite } from '@/lib/types';

export default function InvitesScreen() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const { isAuthenticated, session } = useAuth();

  useEffect(() => {
    if (isAuthenticated && session) {
      apiClient.setAuthToken(session.access_token);
      loadInvites();
    }
  }, [isAuthenticated, session]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getInvites();
      setInvites(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInvites();
    setRefreshing(false);
  };

  const handleAccept = async (inviteId: number) => {
    setProcessingId(inviteId);
    setError('');

    try {
      const result = await apiClient.acceptInvite(inviteId);

      // Remove the accepted invite from the list
      setInvites(prevInvites => prevInvites.filter(inv => inv.id !== inviteId));

      Alert.alert('Success', 'Invite accepted successfully', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate to the group if we have the group ID
            if (result.groupId) {
              router.push(`/groups/${result.groupId}`);
            }
          },
        },
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite');
      Alert.alert('Error', err.message || 'Failed to accept invite');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-semibold text-foreground mb-4">
          Please log in to view invitations
        </Text>
        <Button onPress={() => router.push('/login')}>
          <Text>Go to Login</Text>
        </Button>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-6"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Back Button */}
      <Pressable onPress={() => router.push('/groups')} className="mb-4">
        <Text className="text-sm text-primary">← Back to groups</Text>
      </Pressable>

      {/* Header Section */}
      <View className="mb-6">
        <Text className="text-3xl font-semibold text-foreground mb-2">
          Invitations
        </Text>
        <Text className="text-sm text-muted-foreground">
          You have {invites.length} pending {invites.length === 1 ? 'invitation' : 'invitations'}.
        </Text>
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
          <Text className="text-sm text-muted-foreground mt-2">Loading invitations...</Text>
        </View>
      )}

      {/* Empty State */}
      {!loading && invites.length === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No pending invites</CardTitle>
            <CardDescription>
              When someone invites you to a group, it will show up here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onPress={() => router.push('/groups')}>
              <Text>View my groups</Text>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Invites List */}
      {!loading && invites.length > 0 && (
        <View className="gap-4">
          {invites.map((invite) => (
            <Card key={invite.id}>
              <CardHeader>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{invite.group.name}</CardTitle>
                    <CardDescription>
                      Invited by{' '}
                      <Text className="font-medium text-foreground">
                        {invite.group.creator.email}
                      </Text>
                    </CardDescription>
                  </View>
                  <Badge variant="secondary">
                    {invite.group._count.members}{' '}
                    {invite.group._count.members === 1 ? 'member' : 'members'}
                  </Badge>
                </View>
              </CardHeader>
              <CardContent className="gap-3">
                <Text className="text-sm text-muted-foreground">
                  Invited {new Date(invite.createdAt).toLocaleDateString()}
                </Text>
                <Button
                  onPress={() => handleAccept(invite.id)}
                  disabled={processingId === invite.id}
                >
                  <Text>{processingId === invite.id ? 'Accepting...' : 'Accept invite'}</Text>
                </Button>
              </CardContent>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
