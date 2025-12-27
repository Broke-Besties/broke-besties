import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api';
import { Debt } from '@/lib/types';

type Receipt = {
  id: string;
  groupId: number;
  rawText: string | null;
  createdAt: Date | string;
};

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const debtId = parseInt(id as string, 10);

  const [debt, setDebt] = useState<Debt | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, session, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && session) {
      apiClient.setAuthToken(session.access_token);
      loadData();
    }
  }, [isAuthenticated, session, debtId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const debtData = await apiClient.getDebt(debtId);
      setDebt(debtData);

      // Load receipts if debt has a group
      if (debtData.group) {
        try {
          const receiptsData = await apiClient.getReceipts(debtData.group.id);
          setReceipts(receiptsData);
        } catch (err) {
          // Silently fail for receipts
          console.error('Failed to load receipts:', err);
        }
      }

      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load debt');
      Alert.alert('Error', err.message || 'Failed to load debt');
    } finally {
      setLoading(false);
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
          Please log in to view debt details
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
        <Text className="text-sm text-muted-foreground mt-2">Loading debt...</Text>
      </View>
    );
  }

  if (!debt) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-semibold text-foreground mb-4">
          Debt not found
        </Text>
        <Button onPress={() => router.back()}>
          <Text>Go Back</Text>
        </Button>
      </View>
    );
  }

  const isLender = user?.id === debt.lender.id;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="p-6">
      {/* Header */}
      <View className="mb-6">
        <Pressable onPress={() => router.back()} className="mb-4">
          <Text className="text-sm text-primary">← Back</Text>
        </Pressable>
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1">
            <Text className="text-3xl font-semibold text-foreground">
              Debt details
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              View and manage debt information
            </Text>
          </View>
          <Button variant="secondary" size="sm" onPress={() => router.push('/')}>
            <Text className="text-xs">Dashboard</Text>
          </Button>
        </View>
      </View>

      {/* Error Message */}
      {error && (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 mb-4">
          <Text className="text-sm text-destructive">{error}</Text>
        </View>
      )}

      {/* Debt Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <CardTitle className="text-2xl">${debt.amount.toFixed(2)}</CardTitle>
              <CardDescription className="mt-2">
                {isLender ? (
                  <>
                    Lending to <Text className="font-semibold text-foreground">{debt.borrower.email}</Text>
                  </>
                ) : (
                  <>
                    Borrowing from <Text className="font-semibold text-foreground">{debt.lender.email}</Text>
                  </>
                )}
              </CardDescription>
            </View>
            <Badge variant="outline" className={getStatusColor(debt.status)}>
              {getStatusLabel(debt.status)}
            </Badge>
          </View>
        </CardHeader>
        <CardContent className="gap-4">
          {debt.description && (
            <>
              <View className="gap-1">
                <Label className="text-muted-foreground">Description</Label>
                <Text className="text-base text-foreground">{debt.description}</Text>
              </View>
              <Separator />
            </>
          )}

          {debt.group && (
            <>
              <View className="gap-1">
                <Label className="text-muted-foreground">Group</Label>
                <Text className="text-base text-foreground">{debt.group.name}</Text>
              </View>
              <Separator />
            </>
          )}

          <View className="gap-1">
            <Label className="text-muted-foreground">Created</Label>
            <Text className="text-base text-foreground">
              {new Date(debt.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* Receipts Section */}
      {debt.group && (
        <View className="gap-6">
          {/* Upload Receipt Card */}
          <Card>
            <CardHeader>
              <CardTitle>Upload receipt</CardTitle>
              <CardDescription>
                Receipt upload coming soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" disabled>
                <Text>Coming Soon</Text>
              </Button>
              <Text className="text-xs text-muted-foreground mt-2">
                Receipt upload will be available in a future update
              </Text>
            </CardContent>
          </Card>

          {/* Receipts List Card */}
          <Card>
            <CardHeader>
              <CardTitle>Receipts ({receipts.length})</CardTitle>
              <CardDescription>
                All uploaded receipts for this group
              </CardDescription>
            </CardHeader>
            <CardContent>
              {receipts.length === 0 ? (
                <View className="flex items-center justify-center rounded-md border border-dashed border-border p-12">
                  <Text className="text-sm text-muted-foreground text-center">
                    No receipts uploaded yet
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {receipts.map((receipt) => (
                    <View key={receipt.id} className="rounded-lg border border-border bg-muted/50 p-3">
                      <Text className="text-xs text-muted-foreground mb-2">
                        {new Date(receipt.createdAt).toLocaleString()}
                      </Text>
                      {receipt.rawText && (
                        <Text className="text-xs text-foreground font-mono">
                          {receipt.rawText.substring(0, 150)}
                          {receipt.rawText.length > 150 ? '...' : ''}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
