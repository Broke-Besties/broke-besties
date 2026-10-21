import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/ui/text';

/** The web's logo: the waving raccoon next to "Broke Besties". */
export function Brand() {
  return (
    <View className="flex-row items-center gap-2">
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ width: 28, height: 28, borderRadius: 6 }}
        contentFit="contain"
      />
      <Text className="font-semibold">Broke Besties</Text>
    </View>
  );
}
