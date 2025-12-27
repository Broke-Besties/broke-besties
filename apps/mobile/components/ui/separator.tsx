import React from 'react';
import { View, ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

export type SeparatorProps = ViewProps & {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
};

export function Separator({
  orientation = 'horizontal',
  className,
  ...props
}: SeparatorProps) {
  return (
    <View
      className={cn(
        'bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      {...props}
    />
  );
}
