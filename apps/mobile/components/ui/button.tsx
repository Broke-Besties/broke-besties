import React from 'react';
import { Pressable, Text, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const base =
  'inline-flex items-center justify-center rounded-md transition-opacity active:opacity-70';

const variants: Record<ButtonVariant, string> = {
  default: 'bg-primary',
  secondary: 'bg-secondary',
  outline: 'border border-input bg-background',
  ghost: '',
  destructive: 'bg-destructive',
};

const textVariants: Record<ButtonVariant, string> = {
  default: 'text-primary-foreground font-medium',
  secondary: 'text-secondary-foreground font-medium',
  outline: 'text-foreground font-medium',
  ghost: 'text-foreground font-medium',
  destructive: 'text-destructive-foreground font-medium',
};

const sizes: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 px-3',
  lg: 'h-11 px-8',
  icon: 'h-10 w-10',
};

const textSizes: Record<ButtonSize, string> = {
  default: 'text-sm',
  sm: 'text-sm',
  lg: 'text-base',
  icon: 'text-sm',
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
  const handlePress = (event: any) => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.(event);
    }
  };

  return (
    <Pressable
      className={cn(
        base,
        variants[variant],
        sizes[size],
        disabled && 'opacity-50',
        className
      )}
      onPress={handlePress}
      disabled={disabled}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className={cn(textVariants[variant], textSizes[size])}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
