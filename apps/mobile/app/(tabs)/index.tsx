import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  FileClock,
  Repeat,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

import { IconMedia, ListRow } from '@/components/list-row';
import { PageHeader } from '@/components/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { apiClient } from '@/lib/api';
import type { DashboardData } from '@/lib/types';
import { cn } from '@/lib/utils';

const money = (amount: number) =>
  amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

const personName = (person: { name: string | null; email: string }) => person.name || person.email;

// Same rule as the web dashboard (apps/web/src/app/(app)/dashboard/format.ts).
function nextRenewal(payment: { createdAt: string; frequency: number }): Date {
  const created = new Date(payment.createdAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSince = Math.floor((today.getTime() - created.getTime()) / 86_400_000);
  const next = new Date(created);
  next.setDate(created.getDate() + Math.max(0, Math.ceil(daysSince / payment.frequency)) * payment.frequency);
  if (next <= today) next.setDate(next.getDate() + payment.frequency);
  return next;
}

const REQUEST_LABELS: Record<string, string> = {
  confirm_paid: 'Payment confirmation',
  modify: 'Modification',
  drop: 'Deletion',
};

function Landing() {
  const colors = useColors();
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="flex-grow justify-center gap-8 p-6">
      <Image
        source={require('@/assets/images/mascot/mascot.png')}
        style={{ width: 170, height: 205, alignSelf: 'center' }}
        contentFit="contain"
      />
      <View className="gap-4">
        <Text className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Shared expenses, settled
        </Text>
        <Text className="text-4xl font-bold leading-tight">{'Split the bill,\nkeep the friendship.'}</Text>
        <Text className="leading-6 text-muted-foreground">
          Broke Besties tracks who paid, who owes, and what&apos;s recurring — across roommates, road
          trips, and dinner clubs. See every balance at a glance and settle up without the awkward texts.
        </Text>
      </View>
      <View className="gap-3">
        <Button size="lg" onPress={() => router.push({ pathname: '/login', params: { mode: 'signup' } })}>
          <Text>Get started</Text>
          <ArrowRight color={colors.primaryForeground} size={18} />
        </Button>
        <Button size="lg" variant="outline" onPress={() => router.push('/login')}>
          Log in
        </Button>
      </View>
      <View className="flex-row items-center gap-3">
        <View className="flex-row">
          {['MA', 'SA', 'BE', 'LI'].map((name, i) => (
            <Avatar key={name} name={name} className={cn('h-8 w-8 border-2 border-background', i > 0 && '-ml-2')} />
          ))}
        </View>
        <Text className="flex-1 text-sm text-muted-foreground">Built for roommates, trips &amp; dinner clubs.</Text>
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  const colors = useColors();
  return (
    <Card className="min-w-[45%] flex-1">
      <View className="gap-3 p-4">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-sm text-muted-foreground">{label}</Text>
          <Icon color={colors.mutedForeground} size={16} />
        </View>
        <Text className="text-2xl font-semibold" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      </View>
    </Card>
  );
}

function Dashboard({ token }: { token: string }) {
  const colors = useColors();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'owed' | 'owing'>('owed');

  const load = useCallback(async () => {
    try {
      apiClient.setAuthToken(token);
      setData(await apiClient.getDashboard());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your dashboard');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
        {error ? (
          <>
            <Text className="text-center text-sm text-destructive">{error}</Text>
            <Button variant="outline" onPress={load}>
              Try again
            </Button>
          </>
        ) : (
          <ActivityIndicator color={colors.mutedForeground} />
        )}
      </View>
    );
  }

  const owed = data.debts.filter((debt) => debt.lender.id === data.user.id);
  const owing = data.debts.filter((debt) => debt.borrower.id === data.user.id);
  const total = (list: typeof owed) => list.reduce((sum, debt) => sum + debt.amount, 0);
  const renewals = data.recurringPayments.map(nextRenewal);
  const next = renewals.length ? renewals.reduce((min, d) => (d < min ? d : min)) : null;
  const overdue = data.alerts.filter((alert) => alert.debt);
  const shown = view === 'owed' ? owed : owing;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 p-4 pb-8"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <PageHeader
        title={`Welcome back, ${data.user.name || data.user.email.split('@')[0]}`}
        description="An overview of your debts and recurring payments"
      />

      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {(data.pendingApprovals.length > 0 || overdue.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Requests waiting on your approval and overdue payments</CardDescription>
          </CardHeader>
          <CardContent className="gap-2">
            {data.pendingApprovals.map((request) => (
              <ListRow
                key={`request-${request.id}`}
                media={<IconMedia icon={FileClock} />}
                title={`${REQUEST_LABELS[request.type] ?? request.type} · ${money(request.debt.amount)}`}
                description={`Requested by ${personName(request.requester)}${request.reason ? ` · ${request.reason}` : ''}`}
                href={`/debts/${request.debt.id}`}
              />
            ))}
            {overdue.map((alert) => (
              <ListRow
                key={`alert-${alert.id}`}
                media={<IconMedia icon={AlertTriangle} />}
                title={`Overdue payment · ${money(alert.debt!.amount)}`}
                description={`Owed to ${personName(alert.lender)}${alert.message ? ` · ${alert.message}` : ''}`}
                href={`/debts/${alert.debt!.id}`}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <View className="flex-row flex-wrap gap-3">
        <StatCard label="You are owed" value={money(total(owed))} icon={TrendingUp} />
        <StatCard label="You owe" value={money(total(owing))} icon={TrendingDown} />
        <StatCard label="Active recurring" value={String(data.recurringPayments.length)} icon={Repeat} />
        <StatCard
          label="Next renewal"
          value={next ? next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'None'}
          icon={CalendarClock}
        />
      </View>

      <Card>
        <CardHeader>
          <CardTitle>Debts</CardTitle>
          <CardDescription>Pending balances, tap one for details</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <View className="flex-row rounded-lg bg-muted p-1">
            {(['owed', 'owing'] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => setView(option)}
                className={cn('flex-1 items-center rounded-md py-1.5', view === option && 'bg-background shadow-sm')}
              >
                <Text className={cn('text-sm font-medium', view !== option && 'text-muted-foreground')}>
                  {option === 'owed' ? 'Owed to you' : 'You owe'}
                </Text>
              </Pressable>
            ))}
          </View>
          {shown.length === 0 ? (
            <View className="items-center gap-1 rounded-lg border border-dashed border-border p-6">
              <Text className="text-sm font-medium">
                {view === 'owed' ? 'Nobody owes you' : "You're all square"}
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                {view === 'owed' ? 'Debts friends owe you show up here.' : 'Debts you owe show up here.'}
              </Text>
            </View>
          ) : (
            shown.map((debt) => {
              const other = view === 'owed' ? debt.borrower : debt.lender;
              return (
                <ListRow
                  key={debt.id}
                  media={<Avatar name={personName(other)} />}
                  title={personName(other)}
                  description={[debt.description, debt.group?.name].filter(Boolean).join(' · ') || undefined}
                  trailing={<Text className="text-sm font-semibold">{money(debt.amount)}</Text>}
                  href={`/debts/${debt.id}`}
                />
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <View className="flex-1 gap-1.5">
            <CardTitle>Groups</CardTitle>
            <CardDescription>Where your shared expenses live</CardDescription>
          </View>
          <Button variant="ghost" size="sm" onPress={() => router.push('/groups')}>
            View all
          </Button>
        </CardHeader>
        <CardContent className="gap-2">
          {data.groups.length === 0 ? (
            <Button variant="outline" onPress={() => router.push('/groups')}>
              Create your first group
            </Button>
          ) : (
            data.groups.slice(0, 4).map((group) => (
              <ListRow
                key={group.id}
                media={<IconMedia icon={Users} />}
                title={group.name}
                description={`${group._count.members} ${group._count.members === 1 ? 'member' : 'members'}`}
                href={`/groups/${group.id}`}
              />
            ))
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const { session, isLoading } = useAuth();
  const colors = useColors();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  return session ? <Dashboard token={session.access_token} /> : <Landing />;
}
