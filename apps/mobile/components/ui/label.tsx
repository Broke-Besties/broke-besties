import React from 'react';
import { cn } from '@/lib/utils';
import { Text, TextProps } from '@/components/ui/text';

export function Label({ className, ...props }: TextProps) {
  return <Text className={cn('text-sm font-medium', className)} {...props} />;
}
