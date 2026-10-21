import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { ChevronRight, Mail, Plus, Users } from 'lucide-react-native';

import { PageHeader } from '@/components/page-header';
import { SignedOut } from '@/components/signed-out';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { apiClient } from '@/lib/api';
import { Group } from '@/lib/types';

export default function GroupsScreen() {
  const { session } = useAuth();
  const colors = useColors();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [inviteCount, setInviteCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (token: string) => {
    apiClient.setAuthToken(token);
    try {
      setGroups(await apiClient.getGroups());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    }
    apiClient
      .getInvites()
      .then((invites) => setInviteCount(invites.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (session) load(session.access_token);
  }, [session, load]);

  if (!session) return <SignedOut message="Log in to see your groups." />;

  const onRefresh = async () => {
    setRefreshing(true);
    await load(session.access_token);
    setRefreshing(false);
  };

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiClient.createGroup(newName.trim());
      setShowCreate(false);
      setNewName('');
      await load(session.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-5 p-4 pb-8"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PageHeader
          title="Groups"
          description="Split expenses with the people you share costs with."
          actions={
            <>
              <Button variant="outline" onPress={() => router.push('/invites')}>
                <Mail color={colors.foreground} size={16} />
                <Text>Invites</Text>
                {inviteCount > 0 && <Badge variant="secondary">{inviteCount}</Badge>}
              </Button>
              <Button onPress={() => setShowCreate(true)}>
                <Plus color={colors.primaryForeground} size={16} />
                <Text>Create group</Text>
              </Button>
            </>
          }
        />

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

        {groups === null ? (
          <View className="py-12">
            <ActivityIndicator color={colors.mutedForeground} />
          </View>
        ) : groups.length === 0 ? (
          <View className="items-center gap-3 rounded-xl border border-dashed border-border p-8">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Users color={colors.foreground} size={20} />
            </View>
            <Text className="font-medium">No groups yet</Text>
            <Text className="text-center text-sm text-muted-foreground">
              You haven&apos;t joined any groups. Create one to get started.
            </Text>
            <Button onPress={() => setShowCreate(true)}>
              <Plus color={colors.primaryForeground} size={16} />
              <Text>Create your first group</Text>
            </Button>
          </View>
        ) : (
          <View className="gap-3">
            {groups.map((group) => {
              const members = group._count?.members ?? 0;
              return (
                <Pressable key={group.id} onPress={() => router.push(`/groups/${group.id}` as Href)}>
                  {({ pressed }) => (
                    <Card className={pressed ? 'bg-accent' : undefined}>
                      <View className="flex-row items-center gap-3 p-4">
                        <Avatar name={group.name} className="h-10 w-10" />
                        <View className="flex-1 gap-0.5">
                          <Text className="font-semibold" numberOfLines={1}>
                            {group.name}
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            {members} {members === 1 ? 'member' : 'members'}
                          </Text>
                        </View>
                        <ChevronRight color={colors.mutedForeground} size={16} />
                      </View>
                    </Card>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create group</DialogTitle>
          </DialogHeader>
          <View className="gap-2">
            <Label>Group name</Label>
            <Input value={newName} onChangeText={setNewName} placeholder="e.g. Roommates" autoFocus />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onPress={create} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
