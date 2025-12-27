import React from 'react';
import { Text, TextProps } from 'react-native';
import { cn } from '@/lib/utils';

export type LabelProps = TextProps & {
  className?: string;
};

export function Label({ className, ...props }: LabelProps) {
  return (
    <Text
      className={cn('text-sm font-medium text-foreground', className)}
      {...props}
    />
  );
}
