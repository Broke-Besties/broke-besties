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
import { router, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api';
import { Group, Debt, Member, Invite } from '@/lib/types';
import { cn } from '@/lib/utils';

type GroupWithDetails = Group & {
  members: Member[];
  invites: Invite[];
};

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = parseInt(id as string, 10);

  const [group, setGroup] = useState<GroupWithDetails | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [creating, setCreating] = useState(false);

  const [debtFormData, setDebtFormData] = useState({
    amount: '',
    description: '',
    borrowerEmail: '',
  });

  const { user, session, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && session) {
      apiClient.setAuthToken(session.access_token);
      loadData();
    }
  }, [isAuthenticated, session, groupId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, debtsData] = await Promise.all([
        apiClient.getGroup(groupId),
        apiClient.getGroupDebts(groupId),
      ]);
      setGroup(groupData);
      setDebts(debtsData);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load group data');
      Alert.alert('Error', err.message || 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    setInviting(true);
    setError('');

    try {
      await apiClient.createInvite(groupId, inviteEmail.trim());
      setShowInviteModal(false);
      setInviteEmail('');
      Alert.alert('Success', 'Invite sent successfully');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
      Alert.alert('Error', err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleCreateDebt = async () => {
    if (!debtFormData.borrowerEmail.trim() || !debtFormData.amount.trim()) {
      Alert.alert('Error', 'Please enter borrower email and amount');
      return;
    }

    const amount = parseFloat(debtFormData.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setCreating(true);
    setError('');

    try {
      await apiClient.createDebt({
        amount,
        description: debtFormData.description.trim() || undefined,
        borrowerEmail: debtFormData.borrowerEmail.trim(),
        groupId,
      });
      setShowDebtModal(false);
      setDebtFormData({ amount: '', description: '', borrowerEmail: '' });
      Alert.alert('Success', 'Debt created successfully');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create debt');
      Alert.alert('Error', err.message || 'Failed to create debt');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (debtId: number, newStatus: string) => {
    const oldStatus = debts.find(d => d.id === debtId)?.status;

    // Optimistic update
    setDebts(prevDebts =>
      prevDebts.map(debt =>
        debt.id === debtId ? { ...debt, status: newStatus as any } : debt
      )
    );

    try {
      const result = await apiClient.updateDebtStatus(debtId, newStatus);

      if (!result.success) {
        setError(result.error || 'Failed to update status');
        // Revert
        if (oldStatus) {
          setDebts(prevDebts =>
            prevDebts.map(debt =>
              debt.id === debtId ? { ...debt, status: oldStatus } : debt
            )
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
      // Revert
      if (oldStatus) {
        setDebts(prevDebts =>
          prevDebts.map(debt =>
            debt.id === debtId ? { ...debt, status: oldStatus } : debt
          )
        );
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700';
      case 'paid':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700';
      case 'not_paying':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-700';
      default:
        return '';
    }
  };

  const getStatusLabel = (status: string) => {
    return status === 'not_paying' ? 'Not paying' : status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (!isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-semibold text-foreground mb-4">
          Please log in to view group details
        </Text>
        <Button onPress={() => router.push('/login')}>
          <Text>Go to Login</Text>
        </Button>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
        <Text className="text-sm text-muted-foreground mt-2">Loading group...</Text>
      </View>
    );
  }

  if (!group) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-semibold text-foreground mb-4">
          Group not found
        </Text>
        <Button onPress={() => router.back()}>
          <Text>Go Back</Text>
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
        {/* Back Button */}
        <Pressable onPress={() => router.back()} className="mb-4">
          <Text className="text-sm text-primary">← Back to groups</Text>
        </Pressable>

        {/* Header Section */}
        <View className="mb-6">
          <Text className="text-3xl font-semibold text-foreground mb-2">
            {group.name}
          </Text>
          <Text className="text-sm text-muted-foreground">
            Created {new Date(group.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="flex-row flex-wrap gap-2 mb-6">
          <Button variant="secondary" onPress={() => setShowDebtModal(true)}>
            <Text>Create debt</Text>
          </Button>
          <Button variant="secondary" onPress={() => router.push(`/ai?group=${groupId}`)}>
            <Text>✨ Create with AI</Text>
          </Button>
          <Button onPress={() => setShowInviteModal(true)}>
            <Text>Invite member</Text>
          </Button>
        </View>

        {/* Error Message */}
        {error && (
          <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 mb-4">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        )}

        {/* Members and Invites Cards */}
        <View className="gap-6 mb-6">
          {/* Members Card */}
          <Card>
            <CardHeader>
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <CardTitle>Members</CardTitle>
                  <CardDescription>{group.members.length} total</CardDescription>
                </View>
                <Badge variant="secondary">
                  <Text>{group.members.length}</Text>
                </Badge>
              </View>
            </CardHeader>
            <CardContent className="gap-2">
              {group.members.map((member) => (
                <View key={member.userId} className="rounded-md border border-border bg-background p-3">
                  <Text className="font-medium text-foreground truncate">{member.user.email}</Text>
                  <Text className="text-xs text-muted-foreground">Member</Text>
                </View>
              ))}
            </CardContent>
          </Card>

          {/* Pending Invites Card */}
          <Card>
            <CardHeader>
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <CardTitle>Pending invites</CardTitle>
                  <CardDescription>{group.invites.length} outstanding</CardDescription>
                </View>
                <Badge variant="secondary">
                  <Text>{group.invites.length}</Text>
                </Badge>
              </View>
            </CardHeader>
            <CardContent className="gap-2">
              {group.invites.length === 0 ? (
                <View className="rounded-md border border-border bg-muted/40 p-4">
                  <Text className="text-sm text-muted-foreground">No pending invites.</Text>
                </View>
              ) : (
                group.invites.map((invite) => (
                  <View key={invite.id} className="rounded-md border border-border bg-background p-3">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 min-w-0">
                        <Text className="font-medium text-foreground truncate">{invite.email}</Text>
                        <Text className="text-xs text-muted-foreground">
                          Invited by {invite.group.creator.email}
                        </Text>
                      </View>
                      <Badge variant="outline" className={getStatusColor('pending')}>
                        <Text className="text-xs">Pending</Text>
                      </Badge>
                    </View>
                  </View>
                ))
              )}
            </CardContent>
          </Card>
        </View>

        {/* Group Debts Card */}
        <Card>
          <CardHeader>
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <CardTitle>Group debts</CardTitle>
                <CardDescription>{debts.length} total</CardDescription>
              </View>
              <Badge variant="secondary">
                <Text>{debts.length}</Text>
              </Badge>
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            {debts.length === 0 ? (
              <View className="rounded-md border border-border bg-muted/40 p-8">
                <Text className="text-sm text-muted-foreground text-center">
                  No debts in this group yet.
                </Text>
              </View>
            ) : (
              debts.map((debt) => {
                const isLender = user?.id === debt.lender.id;
                return (
                  <View key={debt.id} className="rounded-lg border border-border bg-background p-4 shadow-sm">
                    <View className="flex-row items-start justify-between gap-3 mb-3">
                      <View className="flex-1 min-w-0 gap-1">
                        <Text className="font-medium text-foreground">
                          {isLender ? (
                            <>
                              <Text className="text-emerald-600">You lent to</Text>
                              {' '}{debt.borrower.email}
                            </>
                          ) : (
                            <>
                              <Text className="text-rose-600">You borrowed from</Text>
                              {' '}{debt.lender.email}
                            </>
                          )}
                        </Text>
                        {debt.description && (
                          <Text className="text-sm text-muted-foreground">{debt.description}</Text>
                        )}
                      </View>

                      <View className="shrink-0 items-end">
                        <Text className="text-lg font-semibold text-foreground">
                          ${debt.amount.toFixed(2)}
                        </Text>
                        <Text className="text-xs text-muted-foreground mt-1">
                          {new Date(debt.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <Separator />

                    <View className="flex-row items-center justify-between gap-3 mt-3">
                      <Badge variant="outline" className={getStatusColor(debt.status)}>
                        <Text className="text-xs">{getStatusLabel(debt.status)}</Text>
                      </Badge>

                      <View className="border border-border rounded-md overflow-hidden bg-background">
                        <Picker
                          selectedValue={debt.status}
                          onValueChange={(value) => handleUpdateStatus(debt.id, value)}
                          style={{ width: 140, height: 36 }}
                        >
                          <Picker.Item label="Pending" value="pending" />
                          <Picker.Item label="Paid" value="paid" />
                          <Picker.Item label="Not Paying" value="not_paying" />
                        </Picker>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
      </ScrollView>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
            </DialogHeader>
            <View className="gap-4 px-6 pb-6">
              <View className="gap-2">
                <Label>Email address</Label>
                <Input
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="member@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
              </View>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setError('');
                  }}
                  disabled={inviting}
                >
                  <Text>Cancel</Text>
                </Button>
                <Button onPress={handleInvite} disabled={inviting}>
                  <Text>{inviting ? 'Sending...' : 'Send invite'}</Text>
                </Button>
              </DialogFooter>
            </View>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Debt Modal */}
      {showDebtModal && (
        <Dialog open={showDebtModal} onOpenChange={setShowDebtModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new debt</DialogTitle>
            </DialogHeader>
            <View className="gap-4 px-6 pb-6">
              <View className="gap-2">
                <Label>Borrower email (must be a group member)</Label>
                <Input
                  value={debtFormData.borrowerEmail}
                  onChangeText={(value) => setDebtFormData({ ...debtFormData, borrowerEmail: value })}
                  placeholder="borrower@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
              </View>
              <View className="gap-2">
                <Label>Amount ($)</Label>
                <Input
                  value={debtFormData.amount}
                  onChangeText={(value) => setDebtFormData({ ...debtFormData, amount: value })}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="gap-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={debtFormData.description}
                  onChangeText={(value) => setDebtFormData({ ...debtFormData, description: value })}
                  placeholder="What is this debt for?"
                  numberOfLines={3}
                />
              </View>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setShowDebtModal(false);
                    setDebtFormData({ amount: '', description: '', borrowerEmail: '' });
                    setError('');
                  }}
                  disabled={creating}
                >
                  <Text>Cancel</Text>
                </Button>
                <Button onPress={handleCreateDebt} disabled={creating}>
                  <Text>{creating ? 'Creating...' : 'Create debt'}</Text>
                </Button>
              </DialogFooter>
            </View>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
