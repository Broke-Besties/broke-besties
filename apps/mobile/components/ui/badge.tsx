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
  const renderedChildren = React.Children.toArray(children).map((child, index) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return (
        <Text key={`badge-text-${index}`} className={cn('text-xs font-medium', textVariants[variant])}>
          {child}
        </Text>
      );
    }
    return child;
  });

  return (
    <View
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5',
        variants[variant],
        className
      )}
      {...props}
    >
      {renderedChildren}
    </View>
  );
}
