import React from 'react';
import { View, ViewProps } from 'react-native';
import { cn } from '@/lib/utils';
import { Text, TextClassContext } from '@/components/ui/text';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const variants: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-primary',
  secondary: 'border-transparent bg-secondary',
  outline: 'border-border',
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

export function Badge({ variant = 'default', children, className, ...props }: BadgeProps) {
  return (
    <TextClassContext.Provider value={cn('text-xs font-medium', textVariants[variant])}>
      <View
        className={cn(
          'flex-row items-center rounded-full border px-2.5 py-0.5',
          variants[variant],
          className
        )}
        {...props}
      >
        {typeof children === 'string' || typeof children === 'number' ? (
          <Text>{children}</Text>
        ) : (
          children
        )}
      </View>
    </TextClassContext.Provider>
  );
}
