import React from 'react';
import { View, Text, ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const variants: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-primary',
  secondary: 'border-transparent bg-secondary',
  outline: 'border-border bg-transparent',
  destructive: 'border-transparent bg-destructive',
};

const textVariants: Record<BadgeVariant, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  destructive: 'text-destructive-foreground',
};

export type BadgeProps = ViewProps & {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
};

export function Badge({
  variant = 'default',
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <View
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5',
        variants[variant],
        className
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className={cn('text-xs font-medium', textVariants[variant])}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
