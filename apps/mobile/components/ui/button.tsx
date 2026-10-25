import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/utils';
import { Text, TextClassContext } from '@/components/ui/text';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const variants: Record<ButtonVariant, string> = {
  default: 'bg-primary',
  secondary: 'bg-secondary',
  outline: 'border border-input bg-background dark:bg-input/30',
  ghost: '',
  destructive: 'bg-destructive dark:bg-destructive/60',
};

const textVariants: Record<ButtonVariant, string> = {
  default: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  ghost: 'text-foreground',
  destructive: 'text-white',
};

const sizes: Record<ButtonSize, string> = {
  default: 'h-10 px-4',
  sm: 'h-9 px-3',
  lg: 'h-12 px-6',
  icon: 'h-10 w-10',
};

export type ButtonProps = PressableProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
};

export function Button({
  variant = 'default',
  size = 'default',
  children,
  className,
  onPress,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <TextClassContext.Provider
      value={cn('text-sm font-medium', size === 'lg' && 'text-base', textVariants[variant])}
    >
      <Pressable
        className={cn(
          'flex-row items-center justify-center gap-2 rounded-md active:opacity-80',
          variants[variant],
          sizes[size],
          disabled && 'opacity-50',
          className
        )}
        onPress={(event) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.(event);
        }}
        disabled={disabled}
        {...props}
      >
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </Pressable>
    </TextClassContext.Provider>
  );
}
