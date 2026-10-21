/** @type {import('tailwindcss').Config} */
const color = (name) => `hsl(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Custom fonts need one family per weight on native, so `font-semibold` etc.
  // pick an Overpass family (below) instead of setting fontWeight.
  corePlugins: { fontWeight: false },
  theme: {
    extend: {
      colors: {
        background: color('background'),
        foreground: color('foreground'),
        card: { DEFAULT: color('card'), foreground: color('card-foreground') },
        popover: { DEFAULT: color('popover'), foreground: color('popover-foreground') },
        primary: { DEFAULT: color('primary'), foreground: color('primary-foreground') },
        secondary: { DEFAULT: color('secondary'), foreground: color('secondary-foreground') },
        muted: { DEFAULT: color('muted'), foreground: color('muted-foreground') },
        accent: { DEFAULT: color('accent'), foreground: color('accent-foreground') },
        destructive: { DEFAULT: color('destructive'), foreground: color('destructive-foreground') },
        border: color('border'),
        input: color('input'),
        ring: color('ring'),
        chart: {
          1: color('chart-1'),
          2: color('chart-2'),
          3: color('chart-3'),
          4: color('chart-4'),
          5: color('chart-5'),
        },
      },
      // The web's --radius is 0.625rem (10px).
      borderRadius: { xl: '14px', lg: '10px', md: '8px', sm: '6px' },
      fontFamily: {
        sans: ['Overpass_400Regular'],
        normal: ['Overpass_400Regular'],
        medium: ['Overpass_500Medium'],
        semibold: ['Overpass_600SemiBold'],
        bold: ['Overpass_700Bold'],
      },
    },
  },
  plugins: [],
};
