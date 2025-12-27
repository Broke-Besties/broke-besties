import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useThemeColor } from '@/hooks/use-theme-color';
import { cn } from '@/lib/utils';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
};

type Group = {
  id: number;
  name: string;
};

export default function AIScreen() {
  const { group: groupParam } = useLocalSearchParams<{ group?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const { isAuthenticated, session } = useAuth();

  const backgroundColor = useThemeColor({}, 'background');
  const primaryColor = useThemeColor({}, 'primary');
  const mutedColor = useThemeColor({}, 'muted');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');

  useEffect(() => {
    if (isAuthenticated && session) {
      apiClient.setAuthToken(session.access_token);
      fetchGroups();
    }
  }, [isAuthenticated, session]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const fetchGroups = async () => {
    try {
      const data = await apiClient.getGroups();
      setGroups(data);

      // Check if group is specified in URL params
      if (groupParam) {
        setGroupId(parseInt(groupParam, 10));
      } else if (data.length > 0) {
        // Auto-select first group if no param and groups available
        setGroupId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Failed to load groups');
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    if (!groupId) {
      setError('Please select a group');
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      id: Date.now().toString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      // Convert our message format to LangChain format
      const langchainMessages = [...messages, userMessage].map((msg) => ({
        type: msg.role === 'user' ? 'human' : 'ai',
        content: msg.content,
      }));

      const data = await apiClient.sendAgentMessage(langchainMessages, groupId);

      // Get the last message from the agent response
      const lastMessage = data.messages[data.messages.length - 1];

      const assistantMessage: Message = {
        role: 'assistant',
        content: lastMessage.content || lastMessage.kwargs?.content || 'No response',
        id: Date.now().toString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-xl font-semibold text-foreground mb-4">
          Please log in to use AI chat
        </Text>
        <Button onPress={() => router.push('/login')}>
          <Text>Go to Login</Text>
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View className="flex-1 p-4">
        <Card className="flex-1">
          <CardHeader>
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1">
                <CardTitle>AI Agent Chat</CardTitle>
                <CardDescription className="mt-1">
                  Chat with the AI agent to manage debts
                </CardDescription>
              </View>
              <Pressable onPress={() => router.back()}>
                <Text className="text-sm text-primary">✕</Text>
              </Pressable>
            </View>

            {/* Group Selector */}
            <View className="border border-border rounded-md overflow-hidden bg-background mt-2">
              <Picker
                selectedValue={groupId}
                onValueChange={(value) => setGroupId(value as number)}
                enabled={!isLoadingGroups}
                style={{ height: 50 }}
              >
                <Picker.Item
                  label={isLoadingGroups ? 'Loading groups...' : 'Select a group'}
                  value={null}
                  enabled={false}
                />
                {groups.map((group) => (
                  <Picker.Item key={group.id} label={group.name} value={group.id} />
                ))}
              </Picker>
            </View>
          </CardHeader>

          <CardContent className="flex-1">
            {/* Messages Area */}
            <ScrollView
              ref={scrollViewRef}
              className="flex-1 mb-4"
              contentContainerClassName="gap-4 pb-2"
            >
              {messages.length === 0 && (
                <View className="items-center py-8">
                  <Text className="text-sm text-muted-foreground text-center">
                    Start a conversation with the AI agent
                  </Text>
                </View>
              )}

              {messages.map((message, index) => (
                <View
                  key={message.id || index}
                  className={cn(
                    'flex-row',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <View
                    className={cn(
                      'rounded-lg px-4 py-3 max-w-[80%]',
                      message.role === 'user' ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-semibold mb-1',
                        message.role === 'user' ? 'text-primary-foreground' : 'text-foreground'
                      )}
                    >
                      {message.role === 'user' ? 'You' : 'Agent'}
                    </Text>
                    <Text
                      className={cn(
                        'text-sm',
                        message.role === 'user' ? 'text-primary-foreground' : 'text-foreground'
                      )}
                    >
                      {message.content}
                    </Text>
                  </View>
                </View>
              ))}

              {isLoading && (
                <View className="flex-row justify-start">
                  <View className="rounded-lg px-4 py-3 bg-muted">
                    <Text className="text-xs font-semibold text-foreground mb-1">Agent</Text>
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator size="small" />
                      <Text className="text-sm text-foreground">Thinking...</Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Error Message */}
            {error && (
              <View className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                <Text className="text-sm text-destructive">{error}</Text>
              </View>
            )}

            {/* Input Area */}
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 border border-border rounded-md px-4 bg-background"
                style={{
                  color: textColor,
                  height: 48,
                  fontSize: 14,
                }}
                value={input}
                onChangeText={setInput}
                placeholder="Type your message..."
                placeholderTextColor="#999"
                editable={!isLoading && groupId !== null}
                multiline
                onSubmitEditing={handleSubmit}
              />
              <Button
                onPress={handleSubmit}
                disabled={isLoading || groupId === null || !input.trim()}
                className="self-end"
              >
                <Text>Send</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}
