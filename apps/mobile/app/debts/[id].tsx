import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { History } from 'lucide-react-native';

import { InfoRow } from '@/components/info-row';
import { PageHeader } from '@/components/page-header';
import { SignedOut } from '@/components/signed-out';
import { StatusBadge } from '@/components/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { apiClient } from '@/lib/api';
import type { DebtDetail } from '@/lib/types';

const money = (amount: number) =>
  amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

const TRANSACTION_LABELS: Record<string, string> = {
  confirm_paid: 'Payment confirmation',
  modify: 'Modification',
  drop: 'Deletion',
};

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, user } = useAuth();
  const colors = useColors();
  const [detail, setDetail] = useState<DebtDetail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(
    async (token: string) => {
      try {
        apiClient.setAuthToken(token);
        setDetail(await apiClient.getDebt(Number(id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load debt');
      }
    },
    [id]
  );

  useEffect(() => {
    if (session) load(session.access_token);
  }, [session, load]);

  if (!session) return <SignedOut message="Log in to see this debt." />;

  if (!detail) {
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

  const { debt, transactions, receiptImageUrls } = detail;
  const isLender = debt.lender.id === user?.id;
  const other = isLender ? debt.borrower : debt.lender;
  const otherName = other.name || other.email;
  const headline = isLender ? `${otherName} owes you` : `You owe ${otherName}`;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-8">
      <Stack.Screen options={{ title: otherName }} />
      <PageHeader
        title={`${headline} ${money(debt.amount)}`}
        description={[debt.description, `Created ${new Date(debt.createdAt).toLocaleDateString()}`]
          .filter(Boolean)
          .join(' · ')}
      />

      <Card>
        <View className="items-center gap-3 p-6">
          <View className="flex-row">
            <Avatar name={debt.borrower.name || debt.borrower.email} className="h-11 w-11 border-2 border-card" />
            <Avatar name={debt.lender.name || debt.lender.email} className="-ml-3 h-11 w-11 border-2 border-card" />
          </View>
          <Text className="text-sm text-muted-foreground">{headline}</Text>
          <Text className="text-4xl font-semibold">{money(debt.amount)}</Text>
          <StatusBadge status={debt.status} />
        </View>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>All change requests for this debt</CardDescription>
        </CardHeader>
        <CardContent className="gap-2">
          {transactions.length === 0 ? (
            <View className="items-center gap-2 py-6">
              <History color={colors.mutedForeground} size={20} />
              <Text className="font-medium">No activity yet</Text>
              <Text className="text-center text-sm text-muted-foreground">
                Change requests and payment confirmations will appear here.
              </Text>
            </View>
          ) : (
            transactions.map((transaction) => (
              <View key={transaction.id} className="flex-row gap-3 rounded-lg border border-border p-3">
                <Avatar name={transaction.requester.name || transaction.requester.email} />
                <View className="flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm font-medium">
                      {TRANSACTION_LABELS[transaction.type] ?? transaction.type}
                    </Text>
                    <StatusBadge status={transaction.status} />
                  </View>
                  <Text className="text-sm text-muted-foreground">
                    {[
                      transaction.requester.name || transaction.requester.email,
                      transaction.proposedAmount !== null && `→ ${money(transaction.proposedAmount)}`,
                      transaction.reason,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Lender" value={debt.lender.name || debt.lender.email} />
          <Separator />
          <InfoRow label="Borrower" value={debt.borrower.name || debt.borrower.email} />
          {debt.group && (
            <>
              <Separator />
              <InfoRow label="Group" value={debt.group.name} />
            </>
          )}
          <Separator />
          <InfoRow label="Created" value={new Date(debt.createdAt).toLocaleDateString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
          <CardDescription>Receipt images attached to this debt</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {receiptImageUrls.length === 0 ? (
            <Text className="text-sm text-muted-foreground">No receipts attached.</Text>
          ) : (
            receiptImageUrls.map((receipt) => (
              <Image
                key={receipt.id}
                source={{ uri: receipt.url }}
                style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 8 }}
                contentFit="cover"
              />
            ))
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
}
