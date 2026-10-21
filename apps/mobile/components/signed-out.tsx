import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/** What a tab shows before you log in. */
export function SignedOut({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
      <Image
        source={require('@/assets/images/mascot/waving.png')}
        style={{ width: 96, height: 116 }}
        contentFit="contain"
      />
      <Text className="text-center text-muted-foreground">{message}</Text>
      <Button onPress={() => router.push('/login')}>Log in</Button>
    </View>
  );
}
