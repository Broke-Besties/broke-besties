import React from 'react';
import { TextInput, TextInputProps, Platform } from 'react-native';
import { cn } from '@/lib/utils';

export type TextareaProps = TextInputProps & {
  className?: string;
};

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <TextInput
      className={cn(
        'min-h-20 rounded-md border border-input bg-background px-4 py-2 text-base text-foreground',
        'focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
      placeholderTextColor="hsl(215.4, 16.3%, 46.9%)"
      multiline
      textAlignVertical="top"
      {...props}
    />
  );
}
