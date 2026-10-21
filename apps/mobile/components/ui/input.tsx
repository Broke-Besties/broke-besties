import React from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { useColors } from '@/hooks/use-colors';

export type InputProps = TextInputProps & {
  className?: string;
};

export function Input({ className, editable, ...props }: InputProps) {
  const colors = useColors();
  return (
    <TextInput
      className={cn(
        'h-11 rounded-md border border-input bg-transparent px-3 font-sans text-base text-foreground dark:bg-input/30',
        editable === false && 'opacity-50',
        className
      )}
      placeholderTextColor={colors.mutedForeground}
      editable={editable}
      {...props}
    />
  );
}
