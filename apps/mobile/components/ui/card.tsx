import React from 'react';
import { View, ViewProps } from 'react-native';
import { cn } from '@/lib/utils';
import { Text, TextProps } from '@/components/ui/text';

type ClassViewProps = ViewProps & { className?: string };

export function Card({ className, ...props }: ClassViewProps) {
  return (
    <View
      className={cn('rounded-xl border border-border bg-card shadow-sm shadow-black/5', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ClassViewProps) {
  return <View className={cn('gap-1.5 p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      className={cn('text-lg font-semibold leading-tight text-card-foreground', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: TextProps) {
  return <Text className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: ClassViewProps) {
  return <View className={cn('px-5 pb-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ClassViewProps) {
  return <View className={cn('flex-row items-center px-5 pb-5', className)} {...props} />;
}
