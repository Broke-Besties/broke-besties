import { extendTailwindMerge } from 'tailwind-merge';

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean>
  | ClassValue[];

function toClassName(value: ClassValue): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return value.map(toClassName).filter(Boolean).join(" ");
  return Object.entries(value)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key)
    .join(" ");
}

// font-medium/semibold/bold are font families here (see tailwind.config.js),
// so they must replace font-sans instead of sitting next to it.
const twMerge = extendTailwindMerge({
  override: { classGroups: { 'font-weight': [] } },
  extend: {
    classGroups: {
      'font-family': [{ font: ['sans', 'normal', 'medium', 'semibold', 'bold'] }],
    },
  },
});

/** Joins class names; a later class wins over an earlier one of the same kind, like the web's cn. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(inputs.map(toClassName).filter(Boolean).join(" "));
}
