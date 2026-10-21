import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

/** The web's page anatomy: title and description, actions underneath on a phone. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-2xl font-semibold leading-tight">{title}</Text>
        {description && <Text className="text-sm text-muted-foreground">{description}</Text>}
      </View>
      {actions && <View className="flex-row flex-wrap gap-2">{actions}</View>}
    </View>
  );
}
