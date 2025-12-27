import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { router, Href } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { Debt } from '@/lib/types';
import { cn } from '@/lib/utils';

function LandingPage() {
  const iconColor = useThemeColor({}, 'icon');
  const tint = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chart.bar.fill"
          style={{ position: 'absolute', bottom: -90, left: -35 }}
        />
      }>
      <ThemedView className="flex-row gap-2">
        <ThemedText type="title">
          Split expenses with your groups, without the chaos.
        </ThemedText>
      </ThemedView>

      <ThemedText style={{ color: iconColor }}>
        Create groups, invite members, and track who owes who what.
      </ThemedText>

      <View className="gap-3 mt-6">
        <Pressable
          onPress={() => router.push('/login' as Href)}
          className="items-center px-5 py-3.5 rounded-[10px] border"
          style={{ backgroundColor: tint, borderColor: tint }}
        >
          <Text className="text-base font-semibold" style={{ color: background }}>
            Get started
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/login' as Href)}
          className="items-center px-5 py-3.5 rounded-[10px] border"
          style={{ backgroundColor: background, borderColor: text }}
        >
          <Text className="text-base font-semibold" style={{ color: text }}>
            Log in
          </Text>
        </Pressable>
      </View>
    </ParallaxScrollView>
  );
}

function DashboardContent() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const { user, session, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && session) {
      apiClient.setAuthToken(session.access_token);
      loadDebts();
    }
  }, [isAuthenticated, session]);

  const loadDebts = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDebts();
      setDebts(Array.isArray(data) ? data : []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load debts');
      setDebts([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDebts();
    setRefreshing(false);
  };

  const handleUpdateStatus = async (debtId: number, newStatus: string) => {
    const oldStatus = debts.find(d => d.id === debtId)?.status;

    setDebts(prevDebts =>
      prevDebts.map(debt =>
        debt.id === debtId ? { ...debt, status: newStatus as any } : debt
      )
    );

    try {
      const result = await apiClient.updateDebtStatus(debtId, newStatus);

      if (!result.success) {
        setError(result.error || 'Failed to update status');
        if (oldStatus) {
          setDebts(prevDebts =>
            prevDebts.map(debt =>
              debt.id === debtId ? { ...debt, status: oldStatus } : debt
            )
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating the status');
      if (oldStatus) {
        setDebts(prevDebts =>
          prevDebts.map(debt =>
            debt.id === debtId ? { ...debt, status: oldStatus } : debt
          )
        );
      }
    }
  };

  const lendingDebts = (debts || []).filter((debt) => debt.lender.id === user?.id);
  const borrowingDebts = (debts || []).filter((debt) => debt.borrower.id === user?.id);

  const calculateTotal = (debtList: Debt[]) => {
    return debtList.reduce((sum, debt) => sum + debt.amount, 0);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        <View className="mb-6">
          <Text className="text-3xl font-semibold text-foreground">Dashboard</Text>
          <Text className="text-sm text-muted-foreground mt-1">Manage your debts and loans.</Text>
        </View>

        <View className="mb-4">
          <Button onPress={() => router.push('/groups' as Href)}>
            View groups
          </Button>
        </View>

        {error && (
          <View className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 mb-4">
            <Text className="text-sm text-destructive">{error}</Text>
          </View>
        )}

        <View className="gap-4">
          <Card>
            <CardHeader>
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <CardTitle>You are lending</CardTitle>
                  <CardDescription>Money owed to you</CardDescription>
                </View>
                <View className="items-end">
                  <Text className="text-2xl font-semibold text-foreground">
                    ${calculateTotal(lendingDebts).toFixed(2)}
                  </Text>
                  <Badge variant="secondary" className="mt-2">
                    {lendingDebts.length} item{lendingDebts.length === 1 ? '' : 's'}
                  </Badge>
                </View>
              </View>
            </CardHeader>
            <CardContent>
              {lendingDebts.length === 0 ? (
                <View className="rounded-md border bg-muted/40 p-6 items-center">
                  <Text className="text-sm text-muted-foreground">No lending records.</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {lendingDebts.map((debt) => (
                    <Pressable
                      key={debt.id}
                      className="rounded-lg border bg-background p-4 shadow-sm active:opacity-70"
                      onPress={() => router.push(`/debts/${debt.id}` as Href)}
                    >
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-1">
                          <Text className="font-medium text-foreground">{debt.borrower.email}</Text>
                          {debt.description && (
                            <Text className="mt-0.5 text-sm text-muted-foreground">{debt.description}</Text>
                          )}
                          {debt.group && (
                            <Text className="mt-2 text-xs text-muted-foreground">
                              Group: <Text className="font-medium text-foreground">{debt.group.name}</Text>
                            </Text>
                          )}
                        </View>
                        <View className="items-end">
                          <Text className="text-lg font-semibold text-foreground">
                            ${debt.amount.toFixed(2)}
                          </Text>
                          <Text className="mt-1 text-xs text-muted-foreground">
                            {new Date(debt.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <Badge
                          variant="outline"
                          className={cn(
                            debt.status === 'pending' && 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700',
                            debt.status === 'paid' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
                            debt.status === 'not_paying' && 'border-rose-500/30 bg-rose-500/10 text-rose-700',
                          )}
                        >
                          {debt.status === 'not_paying' ? 'Not paying' : debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
                        </Badge>

                        <View className="h-9 w-32 rounded-md border bg-background">
                          <Picker
                            selectedValue={debt.status}
                            onValueChange={(value) => handleUpdateStatus(debt.id, value)}
                            style={{ height: 36 }}
                          >
                            <Picker.Item label="Pending" value="pending" />
                            <Picker.Item label="Paid" value="paid" />
                            <Picker.Item label="Not Paying" value="not_paying" />
                          </Picker>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <CardTitle>You are borrowing</CardTitle>
                  <CardDescription>Money you owe</CardDescription>
                </View>
                <View className="items-end">
                  <Text className="text-2xl font-semibold text-foreground">
                    ${calculateTotal(borrowingDebts).toFixed(2)}
                  </Text>
                  <Badge variant="secondary" className="mt-2">
                    {borrowingDebts.length} item{borrowingDebts.length === 1 ? '' : 's'}
                  </Badge>
                </View>
              </View>
            </CardHeader>
            <CardContent>
              {borrowingDebts.length === 0 ? (
                <View className="rounded-md border bg-muted/40 p-6 items-center">
                  <Text className="text-sm text-muted-foreground">No borrowing records.</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {borrowingDebts.map((debt) => (
                    <Pressable
                      key={debt.id}
                      className="rounded-lg border bg-background p-4 shadow-sm active:opacity-70"
                      onPress={() => router.push(`/debts/${debt.id}` as Href)}
                    >
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-1">
                          <Text className="font-medium text-foreground">{debt.lender.email}</Text>
                          {debt.description && (
                            <Text className="mt-0.5 text-sm text-muted-foreground">{debt.description}</Text>
                          )}
                          {debt.group && (
                            <Text className="mt-2 text-xs text-muted-foreground">
                              Group: <Text className="font-medium text-foreground">{debt.group.name}</Text>
                            </Text>
                          )}
                        </View>
                        <View className="items-end">
                          <Text className="text-lg font-semibold text-foreground">
                            ${debt.amount.toFixed(2)}
                          </Text>
                          <Text className="mt-1 text-xs text-muted-foreground">
                            {new Date(debt.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <Badge
                          variant="outline"
                          className={cn(
                            debt.status === 'pending' && 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700',
                            debt.status === 'paid' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
                            debt.status === 'not_paying' && 'border-rose-500/30 bg-rose-500/10 text-rose-700',
                          )}
                        >
                          {debt.status === 'not_paying' ? 'Not paying' : debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
                        </Badge>

                        <View className="h-9 w-32 rounded-md border bg-background">
                          <Picker
                            selectedValue={debt.status}
                            onValueChange={(value) => handleUpdateStatus(debt.id, value)}
                            style={{ height: 36 }}
                          >
                            <Picker.Item label="Pending" value="pending" />
                            <Picker.Item label="Paid" value="paid" />
                            <Picker.Item label="Not Paying" value="not_paying" />
                          </Picker>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}

export default function DashboardScreen() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return isAuthenticated ? <DashboardContent /> : <LandingPage />;
}
