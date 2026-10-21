import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

/** A label on the left and its value on the right, like the web's detail lists. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-3">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium" numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}
