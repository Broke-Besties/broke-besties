import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cn } from '@/lib/utils';

/** Lets a Button or Badge style the Text inside it. */
export const TextClassContext = React.createContext<string | undefined>(undefined);

export type TextProps = RNTextProps & { className?: string };

/** Every piece of text in the app: Overpass, theme foreground, overridable with className. */
export function Text({ className, ...props }: TextProps) {
  const inherited = React.useContext(TextClassContext);
  return (
    <RNText className={cn('font-sans text-base text-foreground', inherited, className)} {...props} />
  );
}
