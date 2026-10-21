import React from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

/** Two-letter initials from a name or email ("Alice Johnson" → "AJ", "bob@x.com" → "BO"). */
export function initials(value: string): string {
  const parts = value.split('@')[0].split(/[\s._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '');
  return letters.toUpperCase() || '?';
}

/** The web's initials avatar. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <View className={cn('h-9 w-9 items-center justify-center rounded-full bg-muted', className)}>
      <Text className="text-xs font-medium text-muted-foreground">{initials(name)}</Text>
    </View>
  );
}
