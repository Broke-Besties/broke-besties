import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Plus, Sparkles, UserPlus } from 'lucide-react-native';

import { ListRow } from '@/components/list-row';
import { PageHeader } from '@/components/page-header';
import { SignedOut } from '@/components/signed-out';
import { StatusBadge } from '@/components/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { apiClient } from '@/lib/api';
import { Debt, Group, Invite, Member } from '@/lib/types';
import { cn } from '@/lib/utils';

type GroupWithDetails = Group & { members: Member[]; invites: Invite[] };

const money = (amount: number) =>
  amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

const nameOf = (user: { name?: string | null; email: string }) => user.name || user.email;

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const { session, user } = useAuth();
  const colors = useColors();

  const [group, setGroup] = useState<GroupWithDetails | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [dialog, setDialog] = useState<'debt' | 'invite' | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [borrowerId, setBorrowerId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(
    async (token: string) => {
      try {
        apiClient.setAuthToken(token);
        const [groupData, debtData] = await Promise.all([
          apiClient.getGroup(groupId),
          apiClient.getGroupDebts(groupId),
        ]);
        setGroup(groupData);
        setDebts(debtData);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load the group');
      }
    },
    [groupId]
  );

  useEffect(() => {
    if (session) load(session.access_token);
  }, [session, load]);

  if (!session) return <SignedOut message="Log in to see this group." />;

  if (!group) {
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

  const others = group.members.filter((member) => member.userId !== user?.id);

  const openDialog = (kind: 'debt' | 'invite') => {
    setDialogError('');
    setDialog(kind);
  };

  const closeDialog = () => {
    setDialog(null);
    setInviteEmail('');
    setBorrowerId(null);
    setAmount('');
    setDescription('');
  };

  const submit = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setDialogError('');
    try {
      await action();
      closeDialog();
      await load(session.access_token);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const parsedAmount = parseFloat(amount);
  const canCreateDebt = !!borrowerId && parsedAmount > 0;

  return (
    <>
      <Stack.Screen options={{ title: group.name }} />
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
        <PageHeader
          title={group.name}
          description={`${group.members.length} ${group.members.length === 1 ? 'member' : 'members'} · Created ${new Date(group.createdAt).toLocaleDateString()}`}
          actions={
            <>
              <Button onPress={() => openDialog('debt')}>
                <Plus color={colors.primaryForeground} size={16} />
                <Text>Add debt</Text>
              </Button>
              <Button variant="outline" onPress={() => openDialog('invite')}>
                <UserPlus color={colors.foreground} size={16} />
                <Text>Invite</Text>
              </Button>
              <Button variant="outline" onPress={() => router.push(`/ai?group=${groupId}`)}>
                <Sparkles color={colors.foreground} size={16} />
                <Text>AI</Text>
              </Button>
            </>
          }
        />

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

        <Card>
          <CardHeader>
            <CardTitle>Debts</CardTitle>
            <CardDescription>Everything owed inside this group</CardDescription>
          </CardHeader>
          <CardContent className="gap-2">
            {debts.length === 0 ? (
              <View className="items-center gap-1 rounded-lg border border-dashed border-border p-6">
                <Text className="text-sm font-medium">No debts yet</Text>
                <Text className="text-center text-sm text-muted-foreground">
                  Add one when someone covers the bill.
                </Text>
              </View>
            ) : (
              debts.map((debt) => {
                const isLender = debt.lender.id === user?.id;
                const other = isLender ? debt.borrower : debt.lender;
                return (
                  <ListRow
                    key={debt.id}
                    media={<Avatar name={nameOf(other)} />}
                    title={nameOf(other)}
                    description={[isLender ? 'Owes you' : 'You owe', debt.description].filter(Boolean).join(' · ')}
                    trailing={
                      <View className="items-end gap-1">
                        <Text className="text-sm font-semibold">{money(debt.amount)}</Text>
                        <StatusBadge status={debt.status} />
                      </View>
                    }
                    href={`/debts/${debt.id}`}
                  />
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Members</CardTitle>
            <Badge variant="secondary">{group.members.length}</Badge>
          </CardHeader>
          <CardContent className="gap-2">
            {group.members.map((member) => (
              <ListRow
                key={member.userId}
                media={<Avatar name={nameOf(member.user)} />}
                title={nameOf(member.user)}
                description={member.user.name ? member.user.email : undefined}
                trailing={member.userId === user?.id ? <Badge variant="outline">You</Badge> : undefined}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Pending invites</CardTitle>
            <Badge variant="secondary">{group.invites.length}</Badge>
          </CardHeader>
          <CardContent className="gap-2">
            {group.invites.length === 0 ? (
              <Text className="text-sm text-muted-foreground">No pending invites.</Text>
            ) : (
              group.invites.map((invite) => (
                <ListRow
                  key={invite.id}
                  media={<Avatar name={invite.invitedEmail} />}
                  title={invite.invitedEmail}
                  description={`Invited by ${invite.sender ? nameOf(invite.sender) : 'a member'}`}
                  trailing={<StatusBadge status="pending" />}
                />
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>

      <Dialog open={dialog === 'debt'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add debt</DialogTitle>
          </DialogHeader>
          <View className="gap-4">
            {dialogError ? <Text className="text-sm text-destructive">{dialogError}</Text> : null}
            <View className="gap-2">
              <Label>Who owes you?</Label>
              {others.length === 0 ? (
                <Text className="text-sm text-muted-foreground">Invite someone to this group first.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {others.map((member) => (
                    <Pressable
                      key={member.userId}
                      onPress={() => setBorrowerId(member.userId)}
                      className={cn(
                        'flex-row items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3',
                        borrowerId === member.userId && 'border-primary bg-primary'
                      )}
                    >
                      <Avatar name={nameOf(member.user)} className="h-7 w-7" />
                      <Text
                        className={cn('text-sm', borrowerId === member.userId && 'text-primary-foreground')}
                      >
                        {nameOf(member.user)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <View className="gap-2">
              <Label>Amount</Label>
              <Input value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
            </View>
            <View className="gap-2">
              <Label>Description</Label>
              <Textarea value={description} onChangeText={setDescription} placeholder="What was it for?" />
            </View>
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy || !canCreateDebt}
              onPress={() =>
                submit(() =>
                  apiClient.createDebt({
                    borrowerId: borrowerId!,
                    amount: parsedAmount,
                    description: description.trim() || undefined,
                    groupId,
                  })
                )
              }
            >
              {busy ? 'Adding…' : 'Add debt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'invite'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
          </DialogHeader>
          <View className="gap-2">
            {dialogError ? <Text className="text-sm text-destructive">{dialogError}</Text> : null}
            <Label>Email</Label>
            <Input
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="friend@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
          </View>
          <DialogFooter>
            <Button variant="outline" onPress={closeDialog} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy || !inviteEmail.trim()}
              onPress={() => submit(() => apiClient.createInvite(groupId, inviteEmail.trim()))}
            >
              {busy ? 'Sending…' : 'Send invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
