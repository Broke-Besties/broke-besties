import React from 'react';
import { Modal, View, Pressable, ModalProps, ViewProps } from 'react-native';
import { cn } from '@/lib/utils';
import { Text, TextProps } from '@/components/ui/text';

export type DialogProps = ModalProps & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export function Dialog({
  open,
  onOpenChange,
  children,
  ...props
}: DialogProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange?.(false)}
      {...props}
    >
      {children}
    </Modal>
  );
}

export type DialogOverlayProps = React.ComponentProps<typeof Pressable> & {
  className?: string;
};

export function DialogOverlay({
  className,
  onPress,
  ...props
}: DialogOverlayProps) {
  return (
    <Pressable
      className={cn('absolute inset-0 bg-black/50', className)}
      onPress={onPress}
      {...props}
    />
  );
}

export type DialogContentProps = ViewProps & {
  className?: string;
};

export function DialogContent({ className, ...props }: DialogContentProps) {
  return (
    <View className="flex-1 items-center justify-center bg-black/50 p-4">
      <View
        className={cn(
          'w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg',
          className
        )}
        {...props}
      />
    </View>
  );
}

export type DialogHeaderProps = ViewProps & {
  className?: string;
};

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return <View className={cn('mb-4 gap-1.5', className)} {...props} />;
}

export type DialogTitleProps = TextProps;

export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <Text
      className={cn(
        'text-lg font-semibold leading-tight text-card-foreground',
        className
      )}
      {...props}
    />
  );
}

export type DialogDescriptionProps = TextProps;

export function DialogDescription({
  className,
  ...props
}: DialogDescriptionProps) {
  return (
    <Text
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export type DialogFooterProps = ViewProps & {
  className?: string;
};

export function DialogFooter({ className, ...props }: DialogFooterProps) {
  return (
    <View
      className={cn('mt-6 flex-row justify-end gap-2', className)}
      {...props}
    />
  );
}
