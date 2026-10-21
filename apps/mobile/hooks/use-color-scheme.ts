import { useColorScheme as useRNColorScheme } from 'react-native';

// React Native can report 'unspecified'; the theme only has light and dark.
export function useColorScheme() {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light';
}
