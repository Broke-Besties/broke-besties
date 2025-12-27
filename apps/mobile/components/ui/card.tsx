import React from 'react';
import { View, Text, ViewProps, TextProps } from 'react-native';
import { cn } from '@/lib/utils';

export type CardProps = ViewProps & {
  className?: string;
};

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-lg border border-border bg-card shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export type CardHeaderProps = ViewProps & {
  className?: string;
};

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <View
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  );
}

export type CardTitleProps = TextProps & {
  className?: string;
};

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <Text
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-card-foreground',
        className
      )}
      {...props}
    />
  );
}

export type CardDescriptionProps = TextProps & {
  className?: string;
};

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  return (
    <Text
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export type CardContentProps = ViewProps & {
  className?: string;
};

export function CardContent({ className, ...props }: CardContentProps) {
  return <View className={cn('p-6 pt-0', className)} {...props} />;
}

export type CardFooterProps = ViewProps & {
  className?: string;
};

export function CardFooter({ className, ...props }: CardFooterProps) {
  return (
    <View
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  );
}
