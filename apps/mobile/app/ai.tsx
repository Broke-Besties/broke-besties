import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { SendHorizontal } from 'lucide-react-native';

import { SignedOut } from '@/components/signed-out';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useColors } from '@/hooks/use-colors';
import { apiClient } from '@/lib/api';
import { Group } from '@/lib/types';
import { cn } from '@/lib/utils';

type Message = { role: 'user' | 'assistant'; content: string; id: string };

export default function AIScreen() {
  const { group: groupParam } = useLocalSearchParams<{ group?: string }>();
  const { session } = useAuth();
  const colors = useColors();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupId, setGroupId] = useState<number | null>(groupParam ? Number(groupParam) : null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const loadGroups = useCallback(async (token: string) => {
    try {
      apiClient.setAuthToken(token);
      const data = await apiClient.getGroups();
      setGroups(data);
      setGroupId((current) => current ?? data[0]?.id ?? null);
    } catch {
      setError('Failed to load groups');
    }
  }, []);

  useEffect(() => {
    if (session) loadGroups(session.access_token);
  }, [session, loadGroups]);

  if (!session) return <SignedOut message="Log in to use the AI assistant." />;

  const send = async () => {
    const content = input.trim();
    if (!content || !groupId) return;
    const userMessage: Message = { role: 'user', content, id: `${Date.now()}` };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setSending(true);
    setError('');
    try {
      const data = await apiClient.sendAgentMessage(
        history.map((message) => ({ type: message.role === 'user' ? 'human' : 'ai', content: message.content })),
        groupId
      );
      const last = data.messages[data.messages.length - 1];
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: last.content || last.kwargs?.content || 'No response', id: `${Date.now()}` },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View className="border-b border-border">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 py-3">
          {groups === null ? (
            <ActivityIndicator color={colors.mutedForeground} />
          ) : (
            groups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => setGroupId(group.id)}
                className={cn(
                  'rounded-full border border-border px-3 py-1.5',
                  groupId === group.id && 'border-primary bg-primary'
                )}
              >
                <Text className={cn('text-sm', groupId === group.id && 'text-primary-foreground')}>
                  {group.name}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="flex-grow gap-3 p-4"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Image
              source={require('@/assets/images/mascot/celebrate.png')}
              style={{ width: 110, height: 132 }}
              contentFit="contain"
            />
            <Text className="font-semibold">Ask the assistant</Text>
            <Text className="text-center text-sm text-muted-foreground">
              Tell it who owes what in plain English, like &ldquo;I paid $60 for dinner, split it with Alice and Bob.&rdquo;
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              className={cn(
                'max-w-[85%] rounded-xl px-4 py-3',
                message.role === 'user' ? 'self-end bg-primary' : 'self-start bg-muted'
              )}
            >
              <Text className={cn('text-sm leading-5', message.role === 'user' && 'text-primary-foreground')}>
                {message.content}
              </Text>
            </View>
          ))
        )}
        {sending && (
          <View className="flex-row items-center gap-2 self-start rounded-xl bg-muted px-4 py-3">
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text className="text-sm text-muted-foreground">Thinking…</Text>
          </View>
        )}
      </ScrollView>

      {error ? <Text className="px-4 pb-2 text-sm text-destructive">{error}</Text> : null}

      <View className="flex-row items-end gap-2 border-t border-border p-3">
        <Textarea
          className="max-h-32 min-h-11 flex-1"
          value={input}
          onChangeText={setInput}
          placeholder={groupId ? 'Message the assistant…' : 'Join a group to use the assistant'}
          editable={!sending && groupId !== null}
        />
        <Button size="icon" onPress={send} disabled={sending || !groupId || !input.trim()} className="h-11 w-11">
          <SendHorizontal color={colors.primaryForeground} size={18} />
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
