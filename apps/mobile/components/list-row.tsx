import React from 'react';
import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useColors } from '@/hooks/use-colors';

/** A bordered row inside a card: leading media, title + description, trailing content. Tappable with `href`. */
export function ListRow({
  media,
  title,
  description,
  trailing,
  href,
}: {
  media?: React.ReactNode;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  href?: Href;
}) {
  const colors = useColors();
  return (
    <Pressable
      disabled={!href}
      onPress={href ? () => router.push(href) : undefined}
      className="flex-row items-center gap-3 rounded-lg border border-border p-3 active:bg-accent"
    >
      {media}
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-medium" numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
      {href ? <ChevronRight color={colors.mutedForeground} size={16} /> : null}
    </Pressable>
  );
}

/** The web's icon tile (ItemMedia variant="icon"). */
export function IconMedia({ icon: Icon }: { icon: LucideIcon }) {
  const colors = useColors();
  return (
    <View className="h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
      <Icon color={colors.foreground} size={16} />
    </View>
  );
}
