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

/**
 * Lightweight `cn` helper for merging class names.
 * Useful for combining Tailwind/NativeWind classes conditionally.
 */
export function cn(...inputs: ClassValue[]) {
  return inputs.map(toClassName).filter(Boolean).join(" ");
}
