import { Pressable, View } from 'react-native';
import { router, Href } from 'expo-router';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

type ButtonProps = {
  children: string;
  variant?: 'primary' | 'outline';
  onPress?: () => void;
};

function Button({ children, variant = 'primary', onPress }: ButtonProps) {
  const tint = useThemeColor({}, 'tint');
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');

  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      className="items-center px-5 py-3.5 rounded-[10px] border"
      style={{
        backgroundColor: isPrimary ? tint : background,
        borderColor: isPrimary ? tint : text,
      }}
    >
      <ThemedText className="text-base font-semibold" style={{ color: isPrimary ? background : text }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const iconColor = useThemeColor({}, 'icon');

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="house.fill"
          style={{ position: 'absolute', bottom: -90, left: -35 }}
        />
      }>
      <ThemedView className="flex-row gap-2">
        <ThemedText type="title">
          Split expenses with your groups, without the chaos.
        </ThemedText>
      </ThemedView>

      <ThemedText style={{ color: iconColor }}>
        Create groups, invite members, and track who owes who what.
      </ThemedText>

      <View className="gap-3 mt-6">
        <Button onPress={() => router.push('/login' as Href)}>
          Get started
        </Button>
        <Button variant="outline" onPress={() => router.push('/login' as Href)}>
          Log in
        </Button>
      </View>
    </ParallaxScrollView>
  );
}
