import React from 'react';
import { TextInput, TextInputProps, Platform } from 'react-native';
import { cn } from '@/lib/utils';

export type InputProps = TextInputProps & {
  className?: string;
};

export function Input({ className, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        'h-10 rounded-md border border-input bg-background px-4 text-base text-foreground',
        'focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-2',
        Platform.OS === 'ios' && 'py-2',
        className
      )}
      placeholderTextColor="hsl(215.4, 16.3%, 46.9%)"
      {...props}
    />
  );
}
