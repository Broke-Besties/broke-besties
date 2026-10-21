import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';

import { PageHeader } from '@/components/page-header';
import { SignedOut } from '@/components/signed-out';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { apiClient } from '@/lib/api';
import { Invite } from '@/lib/types';

export default function InvitesScreen() {
  const { session } = useAuth();
  const colors = useColors();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (token: string) => {
    try {
      apiClient.setAuthToken(token);
      setInvites(await apiClient.getInvites());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    }
  }, []);

  useEffect(() => {
    if (session) load(session.access_token);
  }, [session, load]);

  if (!session) return <SignedOut message="Log in to see your invitations." />;

  const respond = async (invite: Invite, accept: boolean) => {
    setBusyId(invite.id);
    setError('');
    try {
      if (accept) {
        const { group } = await apiClient.acceptInvite(invite.id);
        router.replace(`/groups/${group.id}`);
      } else {
        await apiClient.rejectInvite(invite.id);
        setInvites((current) => current?.filter((item) => item.id !== invite.id) ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 p-4 pb-8"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load(session.access_token);
            setRefreshing(false);
          }}
        />
      }
    >
      <PageHeader title="Invitations" description="Groups you've been invited to join." />

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {invites === null ? (
        <View className="py-12">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : invites.length === 0 ? (
        <View className="items-center gap-3 rounded-xl border border-dashed border-border p-8">
          <View className="h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Mail color={colors.foreground} size={20} />
          </View>
          <Text className="font-medium">No pending invites</Text>
          <Text className="text-center text-sm text-muted-foreground">
            When someone invites you to a group, it shows up here.
          </Text>
        </View>
      ) : (
        invites.map((invite) => {
          const members = invite.group.members?.length ?? 0;
          return (
            <Card key={invite.id}>
              <CardHeader className="flex-row items-center gap-3">
                <Avatar name={invite.group.name} className="h-10 w-10" />
                <View className="flex-1 gap-1">
                  <CardTitle className="text-base">{invite.group.name}</CardTitle>
                  <CardDescription>
                    {`Invited by ${invite.sender?.name || invite.sender?.email || 'a member'} · ${members} ${members === 1 ? 'member' : 'members'}`}
                  </CardDescription>
                </View>
              </CardHeader>
              <CardContent className="flex-row gap-2">
                <Button className="flex-1" onPress={() => respond(invite, true)} disabled={busyId === invite.id}>
                  Accept
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onPress={() => respond(invite, false)}
                  disabled={busyId === invite.id}
                >
                  Decline
                </Button>
              </CardContent>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}
