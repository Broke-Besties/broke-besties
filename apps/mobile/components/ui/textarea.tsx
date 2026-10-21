import React from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { useColors } from '@/hooks/use-colors';

export type TextareaProps = TextInputProps & {
  className?: string;
};

export function Textarea({ className, ...props }: TextareaProps) {
  const colors = useColors();
  return (
    <TextInput
      className={cn(
        'min-h-20 rounded-md border border-input bg-transparent px-3 py-2 font-sans text-base text-foreground dark:bg-input/30',
        className
      )}
      placeholderTextColor={colors.mutedForeground}
      multiline
      textAlignVertical="top"
      {...props}
    />
  );
}
