# Broke Besties iOS app spec (`apps/mobile`)

How to build the app: setup and packages (Part A), project structure and every file (Part B), design system (Part C), navigation and every screen (Part D), and data, auth, receipts, realtime and PayPal (Part E). The backend it talks to is specified in [backend.md](./backend.md).

## Part A: Setup, commands, packages

Every command runs from the repo root unless it says otherwise. Versions were checked against the npm registry and Expo SDK 57's `bundledNativeModules.json` on 2026-09-28. **Always add native modules with `npx expo install`**, which picks the SDK-compatible version. Use `pnpm add` only for pure-JS packages.

### A.1 Prerequisites (one-time, per developer)

| Tool | Version | Why |
|---|---|---|
| macOS + Xcode | Current App Store Xcode (26.x) with an iOS Simulator runtime | Simulator and local `expo run:ios`. Cloud EAS builds don't need a Mac. |
| Node.js | 22 LTS | Expo CLI / Metro |
| pnpm | 10.x (same as `apps/web` CI) | Package manager |
| Watchman | latest (`brew install watchman`) | Fast Metro file watching |
| EAS CLI | `npm i -g eas-cli` (24.x) | Builds, submit, updates, env vars |
| Maestro | `curl -fsSL "https://get.maestro.mobile.dev" \| bash` | E2E tests (release.md Part A) |
| Apple Developer Program | Paid membership ($99/yr) on the account that owns the app | TestFlight, Sign in with Apple, signing |
| Expo account | Member of the `oskip123` owner (or transfer the project to an org) | EAS project `62fdb7af-c55f-4929-a04a-0a999a0c13d0` |

### A.2 Scaffold (Phase 1, day 1)

```bash
# 2.1 Branch
git checkout -b feat/mobile-rebuild

# 2.2 Remove the old app (the EAS projectId + owner are re-added in app.config.ts)
git rm -r apps/mobile
git commit -m "Remove legacy Expo SDK 54 mobile app"

# 2.3 Create the SDK 57 project
cd apps
npx create-expo-app@latest mobile --template default@sdk-57 --no-install
cd mobile

# 2.4 pnpm + Expo: hoist node_modules so Metro and native autolinking resolve everything
printf "node-linker=hoisted\n" > .npmrc
rm -f package-lock.json yarn.lock
pnpm install

# 2.5 Delete the template's demo screens/components (we write our own app/ and src/)
rm -rf app components constants hooks scripts/reset-project.js assets/images/react-logo* assets/images/partial-react-logo.png
```

`apps/mobile` is a **standalone** pnpm project (its own lockfile), not part of a workspace with `apps/web`. That's how both apps were set up before, and it keeps each app's React version separate.

### A.3 Install packages

```bash
cd apps/mobile

# 3.1 Native / Expo modules (versions resolved by the SDK)
npx expo install \
  expo-dev-client expo-updates expo-application expo-constants expo-linking \
  expo-router expo-splash-screen expo-status-bar expo-system-ui expo-font expo-image expo-haptics \
  expo-secure-store expo-crypto expo-web-browser expo-auth-session expo-apple-authentication \
  expo-image-picker expo-image-manipulator expo-clipboard expo-network expo-symbols \
  react-native-reanimated react-native-worklets react-native-gesture-handler \
  react-native-safe-area-context react-native-screens react-native-svg \
  @shopify/react-native-skia react-native-keyboard-controller \
  @react-native-async-storage/async-storage @react-native-community/datetimepicker \
  @react-native-segmented-control/segmented-control

# 3.2 JS-only runtime packages
pnpm add @supabase/supabase-js react-native-url-polyfill \
  @tanstack/react-query \
  nativewind@^4.2.7 \
  react-hook-form @hookform/resolvers zod \
  victory-native lucide-react-native sonner-native \
  @expo-google-fonts/overpass

# 3.3 Dev dependencies
pnpm add -D tailwindcss@^3.4.19 prettier prettier-plugin-tailwindcss \
  jest-expo jest @types/jest @testing-library/react-native \
  eslint eslint-config-expo typescript@~6.0.3 @types/react@~19.2.2

# 3.4 Verify: must print "Dependencies are up to date"
npx expo install --check
npx expo-doctor
```

### A.4 Package manifest (resulting `package.json` dependencies)

`~` = pinned by the Expo SDK (don't bump by hand; use `npx expo install --fix`). `^` = free to take minor updates.

#### Runtime (native, SDK-pinned)

| Package | Version | Purpose |
|---|---|---|
| `expo` | `~57.0.25` | SDK |
| `react` / `react-dom` | `19.2.3` | Required by SDK 57 |
| `react-native` | `0.86.3` | Required by SDK 57 |
| `expo-router` | `~57.0.23` | File-based routing, `NativeTabs`, `Stack.Protected`, form sheets |
| `react-native-screens` | `~4.26.0` | Native stack, form sheets with detents |
| `react-native-safe-area-context` | `~5.7.0` | Insets |
| `react-native-reanimated` | `4.5.1` | Animations (charts, skeleton shimmer, count-up, swipe rows) |
| `react-native-worklets` | `0.10.1` | Reanimated 4 runtime |
| `react-native-gesture-handler` | `~2.32.0` | Swipeable rows, pinch-to-zoom, sheet gestures |
| `react-native-svg` | `15.15.4` | Lucide icons |
| `@shopify/react-native-skia` | `2.6.2` | Chart rendering (victory-native) |
| `react-native-keyboard-controller` | `1.21.9` | Keyboard-aware form scrolling |
| `@react-native-async-storage/async-storage` | `2.2.0` | Non-secret prefs (theme), React Query cache persistence (Phase 2) |
| `@react-native-community/datetimepicker` | `9.1.0` | Reminder deadline date picker |
| `@react-native-segmented-control/segmented-control` | `2.5.7` | Native iOS segmented control (replaces web Tabs/ToggleGroup) |
| `expo-dev-client` | `~57.0.19` | Development builds (needed for Apple Sign-In, Skia, etc.) |
| `expo-updates` | `~57.0.23` | OTA JS updates via EAS Update |
| `expo-secure-store` | `~57.0.4` | Supabase session in the Keychain |
| `expo-crypto` | `~57.0.3` | SHA-256 nonce for Sign in with Apple |
| `expo-apple-authentication` | `~57.0.2` | Native Sign in with Apple button + credential |
| `expo-web-browser` / `expo-auth-session` | `~57.0.3` / `~57.0.13` | Google OAuth in `ASWebAuthenticationSession`; `makeRedirectUri` |
| `expo-image-picker` | `~57.0.20` | Camera + photo library for receipts |
| `expo-image-manipulator` | `~57.0.20` | Resize + JPEG-compress receipts before upload |
| `expo-image` | `~57.0.5` | Cached image display (receipt thumbnails, full-screen viewer) |
| `expo-haptics` | `~57.0.3` | Success / warning / selection haptics |
| `expo-clipboard` | `~57.0.2` | Copy email / user id on Profile |
| `expo-network` | `~57.0.2` | Online/offline → React Query `onlineManager` |
| `expo-font` / `expo-splash-screen` / `expo-status-bar` / `expo-system-ui` | SDK | Fonts, splash, status bar, root background |
| `expo-linking` / `expo-constants` / `expo-application` | SDK | Deep links, config, version display |
| `expo-symbols` | `~57.0.3` | SF Symbols outside the tab bar (optional) |

#### Runtime (JS)

| Package | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | `^2.117.2` | Auth (password, OAuth PKCE, Apple id token), realtime |
| `react-native-url-polyfill` | `^4.0.0` | `URL` for supabase-js (`import 'react-native-url-polyfill/auto'`) |
| `@tanstack/react-query` | `^5.104.0` | Server state |
| `nativewind` | `^4.2.7` | Tailwind class names for React Native (pulls in `react-native-css-interop`) |
| `react-hook-form` | `^7.89.0` | Forms |
| `@hookform/resolvers` | `^5.9.1` | zod resolver |
| `zod` | `^4.6.5` | Form schemas |
| `victory-native` | `^42.0.1` | Area + pie charts on Skia |
| `lucide-react-native` | `^1.48.0` | The same icon set as the web (`lucide-react`) |
| `sonner-native` | `^0.27.0` | Toasts with the same `toast.success/error` API as the web's `sonner` |
| `@expo-google-fonts/overpass` | `^0.4.2` | Overpass, the web's font (TTF for iOS) |

#### Dev

| Package | Version | Purpose |
|---|---|---|
| `typescript` | `~6.0.3` | Same as the SDK 57 template |
| `@types/react` | `~19.2.2` | – |
| `tailwindcss` | `^3.4.19` | NativeWind 4 requires Tailwind v3 (the web uses v4; config is separate) |
| `prettier` + `prettier-plugin-tailwindcss` | latest | Formatting + class sorting |
| `eslint` + `eslint-config-expo` | `^9` / `~57.0.2` | Lint (`expo lint`) |
| `jest` + `jest-expo` | `~57.0.5` | Unit / component tests |
| `@testing-library/react-native` | `^14.0.1` | Component tests |
| `@types/jest` | latest | – |

**Deliberately left out:** Redux/Zustand (React Query + local state is enough), axios (`fetch` is enough), moment/date-fns (`Intl` on Hermes is enough), `@gorhom/bottom-sheet` (native form sheets replace it), `@react-native-google-signin/google-signin` (browser OAuth reuses the web's Google config and needs no new Google client IDs).

### A.5 `package.json` scripts

```jsonc
{
  "name": "broke-besties-mobile",
  "main": "expo-router/entry",
  "private": true,
  "scripts": {
    "start": "expo start --dev-client",
    "ios": "expo run:ios",
    "ios:device": "expo run:ios --device",
    "lint": "expo lint",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "e2e": "maestro test .maestro",
    "doctor": "npx expo-doctor && npx expo install --check",
    "build:dev": "eas build --profile development --platform ios",
    "build:sim": "eas build --profile development-simulator --platform ios",
    "build:preview": "eas build --profile preview --platform ios",
    "build:prod": "eas build --profile production --platform ios",
    "submit:prod": "eas submit --profile production --platform ios --latest",
    "update:preview": "eas update --channel preview --environment preview",
    "update:prod": "eas update --channel production --environment production"
  },
  "jest": { "preset": "jest-expo/ios", "setupFilesAfterEnv": ["./jest.setup.ts"] }
}
```

### A.6 EAS project wiring (one-time)

```bash
cd apps/mobile
eas login
eas init --id 62fdb7af-c55f-4929-a04a-0a999a0c13d0   # link the existing EAS project
eas build:configure --platform ios                    # then replace eas.json with release.md §A.3

# Environment variables (per EAS environment; all are public client values)
for ENV in development preview production; do
  eas env:create --environment $ENV --name EXPO_PUBLIC_API_URL        --value "<url for $ENV>"          --visibility plaintext
  eas env:create --environment $ENV --name EXPO_PUBLIC_SUPABASE_URL   --value "<supabase url for $ENV>" --visibility plaintext
  eas env:create --environment $ENV --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon key>"          --visibility plaintext
done
eas env:pull --environment development   # writes .env.local for local dev (git-ignored)
```

Local `.env.local` (never committed):

```bash
APP_VARIANT=development
EXPO_PUBLIC_API_URL=http://192.168.1.23:3000        # your Mac's LAN IP for a physical device; localhost for the simulator
EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.23:54321  # local `supabase start`, or staging
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

### A.7 Everyday commands

| Task | Command |
|---|---|
| First development build for the simulator | `pnpm build:sim` → `eas build:run -p ios --latest` (installs into the booted simulator) |
| Development build for your iPhone | `eas device:create` (register the UDID once), then `pnpm build:dev`, then install from the QR code |
| Run the JS server | `pnpm start` (press `i` for the simulator; the device dev client scans the QR) |
| Local native build instead of EAS | `pnpm ios` (needs Xcode; runs `expo prebuild` automatically; `ios/` is git-ignored) |
| Run the web backend for local dev | `cd apps/web && pnpm dev` (starts Supabase + Next on :3000) |
| Typecheck / lint / unit tests | `pnpm typecheck && pnpm lint && pnpm test` |
| E2E on the simulator | `pnpm e2e` |
| Ship a TestFlight build | `pnpm build:prod && pnpm submit:prod` (or `eas build -p ios --profile production --auto-submit`) |
| Hot-fix JS on TestFlight without a rebuild | `pnpm update:prod -- --message "Fix X"` (only when `runtimeVersion` is unchanged, release.md §A.5) |

### A.8 Git ignore additions (`apps/mobile/.gitignore`)

```
node_modules/
.expo/
dist/
ios/
android/
.env*.local
*.tsbuildinfo
coverage/
.maestro/screenshots/
```

`ios/` and `android/` are generated by `expo prebuild` (Continuous Native Generation). All native configuration lives in `app.config.ts` and config plugins. Never hand-edit native projects.


---

## Part B: Project structure and what goes in each file

Conventions:
- TypeScript strict mode. Import alias `@/*` → `src/*`. Route files live in `app/`; everything else lives in `src/`.
- Route files stay thin: read params, call hooks, compose components. Business math lives in `src/lib/*` (pure, unit-tested). Fetching lives in `src/hooks/queries|mutations/*`.
- One component per file. Component files use PascalCase; lib and hook files use camelCase or kebab-case.
- Tests live next to the code: `foo.ts` → `foo.test.ts`.

### B.1 Tree

```
apps/mobile/
├── app.config.ts                 # Expo config (variants, plugins, iOS settings)
├── eas.json                      # Build/submit/update profiles (release.md §A.3)
├── package.json                  # §A.5
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── global.css                    # NativeWind + theme CSS variables
├── nativewind-env.d.ts
├── jest.setup.ts
├── eslint.config.js
├── .prettierrc
├── .npmrc                        # node-linker=hoisted
├── .gitignore                    # §A.8
├── assets/
│   ├── icon.png                  # 1024×1024 PNG, no transparency (App Store requirement)
│   ├── icon-dark.png             # iOS 18+ dark icon variant (optional)
│   └── splash-icon.png           # 512×512 transparent PNG of the logo mark
├── .maestro/                     # E2E flows (release.md §A.1.4)
├── app/                          # expo-router routes (§B.3)
└── src/
    ├── lib/                      # §B.4: pure logic + clients
    │   ├── env.ts
    │   ├── supabase.ts
    │   ├── secure-storage.ts
    │   ├── api/{client.ts, endpoints.ts, types.ts, errors.ts}
    │   ├── query/{client.ts, keys.ts}
    │   ├── format.ts
    │   ├── debts.ts
    │   ├── balances.ts
    │   ├── chart-series.ts
    │   ├── recurring.ts
    │   ├── splits.ts
    │   ├── receipt-image.ts
    │   ├── haptics.ts
    │   ├── action-sheet.ts
    │   ├── confirm.ts
    │   └── responsive.ts
    ├── providers/                # §B.5
    │   ├── AppProviders.tsx
    │   ├── AuthProvider.tsx
    │   └── ThemeProvider.tsx
    ├── hooks/                    # §B.6
    │   ├── queries/*.ts
    │   ├── mutations/*.ts
    │   ├── useRefreshOnFocus.ts
    │   ├── useGroupMembershipRealtime.ts
    │   └── useDebounced.ts
    ├── theme/                    # §B.7 (values in Part C)
    │   ├── tokens.ts
    │   ├── fonts.ts
    │   ├── header.ts
    │   └── useThemeColors.ts
    ├── components/               # §B.8
    │   ├── ui/                   # shadcn-equivalent primitives
    │   ├── charts/
    │   ├── auth/
    │   ├── dashboard/
    │   ├── debts/
    │   ├── groups/
    │   ├── friends/
    │   ├── tabs/
    │   ├── recurring/
    │   ├── alerts/
    │   ├── paypal/               # PayWithPaypalButton, PaypalCard
    │   └── receipts/
    └── test/
        ├── render.tsx            # renderWithProviders()
        └── fixtures.ts           # typed sample Debt/Group/... objects
```

### B.2 Root config files

#### `app.config.ts`

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

type Variant = 'development' | 'preview' | 'production';
const variant = (process.env.APP_VARIANT ?? 'production') as Variant;

const VARIANTS = {
  development: { name: 'BB Dev',        bundleId: 'com.brokebesties.app.dev',     scheme: 'brokebesties-dev' },
  preview:     { name: 'BB Preview',    bundleId: 'com.brokebesties.app.preview', scheme: 'brokebesties-preview' },
  production:  { name: 'Broke Besties', bundleId: 'com.brokebesties.app',         scheme: 'brokebesties' },
} as const;

const v = VARIANTS[variant];
const EAS_PROJECT_ID = '62fdb7af-c55f-4929-a04a-0a999a0c13d0';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: v.name,
  slug: 'mobile',                 // must match the existing EAS project slug; rename on expo.dev first if you change it
  owner: 'oskip123',
  version: '1.0.0',               // marketing version (CFBundleShortVersionString); bump per public release
  scheme: v.scheme,
  orientation: 'default',         // iPhone is locked to portrait via infoPlist below; iPad rotates
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'fingerprint' },
  updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 },
  ios: {
    bundleIdentifier: v.bundleId,
    supportsTablet: true,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },   // TestFlight export-compliance answer: no custom crypto
    infoPlist: {
      UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight',
      ],
      ...(variant === 'development' ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } : {}),
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
      ],
    },
  },
  android: { package: v.bundleId.replace(/-/g, '_') },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-web-browser',
    ['expo-splash-screen', {
      image: './assets/splash-icon.png', imageWidth: 160, resizeMode: 'contain',
      backgroundColor: '#ffffff', dark: { backgroundColor: '#0a0a0a' },
    }],
    ['expo-image-picker', {
      photosPermission: 'Choose a receipt photo to split it with your group.',
      cameraPermission: 'Take a photo of a receipt to split it with your group.',
      microphonePermission: false,
    }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { eas: { projectId: EAS_PROJECT_ID }, variant },
});
```

#### `babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
```
(Reanimated 4's worklets plugin is added automatically by `babel-preset-expo`. Don't list it again.)

#### `metro.config.js`

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });
```

#### `tailwind.config.js`

```js
/** @type {import('tailwindcss').Config} */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class', // lets ThemeProvider force light/dark; "system" follows the OS
  theme: {
    extend: {
      colors: {
        background: c('background'), foreground: c('foreground'),
        card: { DEFAULT: c('card'), foreground: c('card-foreground') },
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground') },
        secondary: { DEFAULT: c('secondary'), foreground: c('secondary-foreground') },
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
        destructive: { DEFAULT: c('destructive'), foreground: c('destructive-foreground') },
        positive: c('positive'), negative: c('negative'),
        border: c('border'), input: c('input'), ring: c('ring'),
        chart: { 1: c('chart-1'), 2: c('chart-2'), 3: c('chart-3'), 4: c('chart-4'), 5: c('chart-5') },
      },
      fontFamily: {
        body: ['Overpass_400Regular'], 'body-medium': ['Overpass_500Medium'],
        'body-semibold': ['Overpass_600SemiBold'], 'body-bold': ['Overpass_700Bold'],
      },
      borderRadius: { sm: '8px', md: '10px', lg: '14px', xl: '20px' },
    },
  },
  plugins: [],
};
```

#### `global.css`

Values are the RGB triplets from §C.1.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 255 255 255;   --foreground: 10 10 10;
  --card: 255 255 255;         --card-foreground: 10 10 10;
  --primary: 23 23 23;         --primary-foreground: 250 250 250;
  --secondary: 245 245 245;    --secondary-foreground: 23 23 23;
  --muted: 245 245 245;        --muted-foreground: 115 115 115;
  --accent: 245 245 245;       --accent-foreground: 23 23 23;
  --destructive: 231 0 11;     --destructive-foreground: 250 250 250;
  --positive: 0 120 111;       --negative: 231 0 11;
  --border: 229 229 229;       --input: 229 229 229;   --ring: 161 161 161;
  --chart-1: 245 73 0; --chart-2: 0 150 137; --chart-3: 16 78 100; --chart-4: 255 185 0; --chart-5: 254 154 0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 10 10 10;      --foreground: 250 250 250;
    --card: 23 23 23;            --card-foreground: 250 250 250;
    --primary: 229 229 229;      --primary-foreground: 23 23 23;
    --secondary: 38 38 38;       --secondary-foreground: 250 250 250;
    --muted: 38 38 38;           --muted-foreground: 161 161 161;
    --accent: 38 38 38;          --accent-foreground: 250 250 250;
    --destructive: 255 100 103;  --destructive-foreground: 250 250 250;
    --positive: 0 188 125;       --negative: 255 100 103;
    --border: 46 46 46;          --input: 56 56 56;      --ring: 115 115 115;
    --chart-1: 20 71 230; --chart-2: 0 188 125; --chart-3: 254 154 0; --chart-4: 173 70 255; --chart-5: 255 32 86;
  }
}
```

#### `nativewind-env.d.ts`
`/// <reference types="nativewind/types" />`

#### `tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts", "nativewind-env.d.ts"]
}
```

#### `jest.setup.ts`
- `import '@testing-library/react-native/extend-expect'`
- Mock `expo-secure-store` (in-memory Map), `expo-haptics` (no-ops), `expo-image-picker`, `expo-apple-authentication`, `sonner-native` (`toast` as `jest.fn()` spies), and `@/lib/supabase` (`auth.getSession` returns a fake session).
- `jest.useFakeTimers()` is **not** global; opt in per test.

#### `eslint.config.js`
`expo lint` flat config (`eslint-config-expo/flat`) plus these rules: `no-restricted-imports` blocks `react-native`'s `Text` in `app/**` and `src/components/**` except `src/components/ui/Text.tsx` (use the themed `Text`), and blocks importing `@/lib/api/client` outside `src/lib/api/endpoints.ts` and `src/hooks/**`.

#### `.prettierrc`
`{ "singleQuote": true, "semi": true, "printWidth": 100, "plugins": ["prettier-plugin-tailwindcss"] }`

### B.3 `app/`: route files

Full route table and per-screen specs are in Part D. Here is what each **file** contains.

```
app/
├── _layout.tsx
├── +not-found.tsx
├── (auth)/
│   ├── _layout.tsx
│   ├── welcome.tsx
│   ├── login.tsx
│   └── signup.tsx
├── auth/
│   └── callback.tsx
├── paypal/
│   ├── connected.tsx             # fallback landing for {scheme}://paypal/connected
│   └── return.tsx                # fallback landing for {scheme}://paypal/return (captures)
└── (app)/
    ├── _layout.tsx
    ├── (tabs)/
    │   ├── _layout.tsx
    │   ├── (home)/{_layout.tsx, index.tsx}
    │   ├── (debts)/{_layout.tsx, debts.tsx}
    │   ├── (groups)/{_layout.tsx, groups.tsx}
    │   ├── (friends)/{_layout.tsx, friends.tsx}
    │   └── (more)/{_layout.tsx, more.tsx, tabs.tsx, recurring.tsx, alerts.tsx, profile.tsx, appearance.tsx}
    ├── debts/{[id].tsx, requests.tsx}
    ├── groups/[id].tsx
    ├── recurring/[id].tsx
    ├── invites.tsx
    ├── notifications.tsx
    ├── quick-add.tsx
    ├── receipt-viewer.tsx
    ├── scan/{_layout.tsx, index.tsx, assign.tsx}
    └── sheets/{new-debt, confirm-paid, modify-debt, delete-debt, reminder, new-group,
               group-add-debts, group-invite, add-friend, new-tab, new-recurring, delete-account}.tsx
```

| File | Contents |
|---|---|
| `app/_layout.tsx` | Imports `react-native-url-polyfill/auto` and `../global.css`. Calls `SplashScreen.preventAutoHideAsync()` at module scope. Loads the four Overpass weights with `useFonts`. Wraps everything in `<AppProviders>`. Renders `<RootNavigator>`, which reads `useAuth()` and returns `null` until fonts are loaded and `auth.isLoading === false`, then hides the splash screen. Renders a `Stack` (`headerShown:false`) with `<Stack.Protected guard={!!session}>` around `(app)` and `<Stack.Protected guard={!session}>` around `(auth)`; `auth/callback` and `+not-found` are always reachable. |
| `app/+not-found.tsx` | `Empty` with the title "Page not found" and a "Go home" button → `router.replace('/')`. |
| `app/(auth)/_layout.tsx` | `Stack` with a transparent header, back button on login/signup, no header on welcome. |
| `app/(auth)/welcome.tsx` | Welcome screen (§S1). |
| `app/(auth)/login.tsx` | `<AuthForm mode="login" />` (§S2). |
| `app/(auth)/signup.tsx` | `<AuthForm mode="signup" />` (§S3). |
| `app/paypal/connected.tsx`, `app/paypal/return.tsx` | Fallback deep-link landings for when PayPal hands off to the PayPal app or Safari, so the redirect reaches the app outside the auth session. `connected`: invalidate `['paypal','account']`, toast, `router.replace('/profile')`. `return`: if `status=approved`, run the same capture step as §E.6 for `pp`, then `router.replace('/debts/{debtId}')`. Normally not hit, because `openAuthSessionAsync` returns the URL to the caller. |
| `app/auth/callback.tsx` | Google OAuth fallback landing: reads `code` from `useLocalSearchParams`, calls `supabase.auth.exchangeCodeForSession(code)`, then `router.replace('/')`; on failure shows a toast and goes to `/(auth)/login`. Normally not hit, because `openAuthSessionAsync` returns the URL to the caller (§E.2.4). |
| `app/(app)/_layout.tsx` | Root app `Stack`: `(tabs)` has `headerShown:false`; detail screens use the default native header with `headerBackButtonDisplayMode:'minimal'`; modal screens are configured as in the table in §D.2. Mounts `useGroupMembershipRealtime()` and `useRefreshOnFocus([qk.counts])`. |
| `app/(app)/(tabs)/_layout.tsx` | `NativeTabs` from `expo-router/unstable-native-tabs` with 5 triggers (§D.1). Badges come from `useCounts()`. **This is the only file that imports NativeTabs.** Swapping to `Tabs` from `expo-router` must stay a change to this one file. |
| `app/(app)/(tabs)/(*)/_layout.tsx` | Each tab's own `Stack` with the large-title header options from `src/theme/header.ts` (`headerLargeTitle: true`, `headerTransparent: true`, `headerBlurEffect: 'systemChromeMaterial'`, `headerShadowVisible: false`, Overpass title fonts). |
| `app/(app)/(tabs)/(home)/index.tsx` | Home (§S5). |
| `app/(app)/(tabs)/(debts)/debts.tsx` | Debts list (§S8). |
| `app/(app)/(tabs)/(groups)/groups.tsx` | Groups list (§S13). |
| `app/(app)/(tabs)/(friends)/friends.tsx` | Friends (§S17). |
| `app/(app)/(tabs)/(more)/more.tsx` | More menu (§S19). |
| `app/(app)/(tabs)/(more)/{tabs,recurring,alerts,profile,appearance}.tsx` | Doc 07 §S20–S24 (pushed inside the More tab's stack, so the tab bar stays visible). |
| `app/(app)/debts/[id].tsx` | Debt detail (§S9). Pushed over the tabs. |
| `app/(app)/debts/requests.tsx` | Requests inbox (§S10). |
| `app/(app)/groups/[id].tsx` | Group detail (§S14). |
| `app/(app)/recurring/[id].tsx` | Recurring detail (§S22). |
| `app/(app)/invites.tsx` | Group invites (§S16). |
| `app/(app)/notifications.tsx` | Notifications sheet (§S6). |
| `app/(app)/quick-add.tsx` | Quick add sheet (§S7). |
| `app/(app)/receipt-viewer.tsx` | Full-screen receipt viewer; params `urls` (JSON array) and `index` (§S12). |
| `app/(app)/scan/_layout.tsx` | `Stack` presented as a modal with a Cancel button on the left. On cancel it deletes the unused receipt (§E.4). |
| `app/(app)/scan/index.tsx` | Scan step 1 (§S25). |
| `app/(app)/scan/assign.tsx` | Scan step 2 (§S26). |
| `app/(app)/sheets/*.tsx` | One form per file, each wrapped in `<FormSheet title footer>`. Specs in §S11 and each owning screen. |

### B.4 `src/lib/`

#### `env.ts`

```ts
const req = (name: string, v: string | undefined) => { if (!v) throw new Error(`Missing ${name}`); return v; };
export const env = {
  apiUrl: req('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, ''),
  supabaseUrl: req('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: req('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
} as const;
```
Expo inlines `process.env.EXPO_PUBLIC_*` at build time, so each one must be read with its full static name. A dynamic `process.env[name]` doesn't work.

#### `secure-storage.ts`

Supabase's session JSON can be larger than the Keychain item size that is safe to store, so values are split into 1,800-character chunks.

```ts
import * as SecureStore from 'expo-secure-store';
const CHUNK = 1800;
const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } as const;

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const n = await SecureStore.getItemAsync(`${key}.n`, opts);
    if (n == null) return null;
    const parts = await Promise.all(
      Array.from({ length: Number(n) }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`, opts)));
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await secureStorage.removeItem(key);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [''];
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}.${i}`, c, opts)));
    await SecureStore.setItemAsync(`${key}.n`, String(chunks.length), opts);
  },
  async removeItem(key: string): Promise<void> {
    const n = Number((await SecureStore.getItemAsync(`${key}.n`, opts)) ?? 0);
    await Promise.all([
      ...Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`, opts)),
      SecureStore.deleteItemAsync(`${key}.n`, opts),
    ]);
  },
};
```
Test: a round-trip of a 5,000-character string; remove clears every chunk.

#### `supabase.ts`

```ts
import { AppState } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';
import { env } from './env';
import { secureStorage } from './secure-storage';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    lock: processLock,
  },
});

// Refresh tokens only while the app is in the foreground (Supabase RN guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

#### `api/errors.ts`

```ts
export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) { super(message); this.name = 'ApiError'; }
  get isNetwork() { return this.status === 0; }
}
/** Message suitable for a toast. Server messages are already human-readable (see backend.md Part C). */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.') {
  if (e instanceof ApiError) return e.isNetwork ? "You're offline. Check your connection and try again." : e.message;
  return fallback;
}
```

#### `api/client.ts`

```ts
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import Constants from 'expo-constants';
import { ApiError } from './errors';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Opts = { timeoutMs?: number };

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function send(method: Method, path: string, body: unknown, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const t = await token();
  try {
    return await fetch(`${env.apiUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        'X-App-Variant': Constants.expoConfig?.extra?.variant ?? 'production', // backend picks the PayPal return scheme from this
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(method: Method, path: string, body?: unknown, opts: Opts = {}): Promise<T> {
  const timeout = opts.timeoutMs ?? 20_000;
  let res = await send(method, path, body, timeout);
  if (res.status === 401) {
    const { error } = await supabase.auth.refreshSession();
    if (!error) res = await send(method, path, body, timeout);
    if (res.status === 401) {
      await supabase.auth.signOut(); // AuthProvider routes to (auth)
      throw new ApiError(401, 'Your session expired. Please log in again.');
    }
  }
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = text; }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string, o?: Opts) => request<T>('GET', p, undefined, o),
  post: <T = unknown>(p: string, b?: unknown, o?: Opts) => request<T>('POST', p, b ?? {}, o),
  put: <T = unknown>(p: string, b: unknown, o?: Opts) => request<T>('PUT', p, b, o),
  patch: <T = unknown>(p: string, b: unknown, o?: Opts) => request<T>('PATCH', p, b, o),
  del: <T = unknown>(p: string, o?: Opts) => request<T>('DELETE', p, undefined, o),
  upload: <T>(p: string, file: { uri: string; name: string; type: string }, fields?: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file as unknown as Blob); // React Native's FormData accepts { uri, name, type }
    Object.entries(fields ?? {}).forEach(([k, v]) => form.append(k, v));
    return request<T>('POST', p, form, { timeoutMs: 60_000 });
  },
};
```
Pass `{ timeoutMs: 90_000 }` for `receiptsApi.parse` (Gemini can be slow).
Tests (mock `fetch` and `supabase`): adds the bearer header; parses `{error}`; retries once on 401 after a successful refresh; signs out on a second 401; timeout → `ApiError(0)`; FormData has no JSON content type.

#### `api/types.ts`, `api/endpoints.ts`
Exactly as in backend.md §C.2 and §B.3.

#### `query/client.ts`

```ts
import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { ApiError } from '@/lib/api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
    mutations: { retry: 0 },
  },
});

AppState.addEventListener('change', (s) => { if (Platform.OS !== 'web') focusManager.setFocused(s === 'active'); });
onlineManager.setEventListener((setOnline) => {
  const sub = Network.addNetworkStateListener((st) => setOnline(!!st.isConnected));
  return () => sub.remove();
});
```

#### `query/keys.ts`
The key factory. Every key is listed in §E.1.1.

#### `format.ts` (pure; unit-tested)

| Function | Behavior |
|---|---|
| `money(n)` | `Intl.NumberFormat('en-US', { style:'currency', currency:'USD' })` → `$1,234.50` |
| `signedMoney(n, dir)` | `+$12.00` for lending, `-$12.00` for borrowing (web shows the same signs) |
| `net(n)` | `+$5.00` / `-$5.00` (the web's `${n>=0?'+':'-'}$${abs}`) |
| `shortDate(iso)` | `Sep 28` (the web's `formatShortDate`) |
| `longDate(iso)` | `Sep 28, 2026` |
| `relativeDays(n)` | `Today` / `Tomorrow` / `In 3 days` (for upcoming renewals) |
| `initials(nameOrEmail)` | Port of the web's `initials()` (split on `[\s._@-]+`, first 2 letters, uppercase) |
| `displayName(u)` | `u.name || u.email` |
| `frequencyLabel(days)` | `null`→`Off`, 7→`Weekly`, 14→`Biweekly`, 30→`Monthly`, else `Every N days` |
| `cadenceText(days)` | Port of `recurring-payments/format.ts` (`namedCadence`, `frequencyText`) |
| `transactionTypeLabel(t)` | `confirm_paid`→`Payment confirmation`, `modify`→`Modification request`, `drop`→`Deletion request` |
| `parseMoneyInput(s)` | Strips `$`, `,` and spaces; returns `number` rounded to 2 decimals, or `null` if not > 0 |

#### `debts.ts` (pure)
- `direction(debt, meId): 'lending' | 'borrowing'`
- `otherParty(debt, meId): UserLite`
- `summarize(debts, meId)` → `{ owedToMe, iOwe, net, pendingLendingCount, pendingBorrowingCount }` (pending only, as on the web's Debts page)
- `filterDebts(debts, { view, status, query }, meId)` → the web's search matches the other party's name/email, the description, or the group name, case-insensitive
- `sortDebts(debts, key: 'date'|'amount', dir)`
- `needsMyApproval(tx, meId)` → `(meId === tx.debt.lenderId && !tx.lenderApproved) || (meId === tx.debt.borrowerId && !tx.borrowerApproved)` (the requests inbox split)
- `pendingTransactionFor(transactions)` → the first with `status === 'pending'`
- `canRequestChange(debt, pendingTx)` → `debt.status === 'pending' && !pendingTx` (the web's `canAct`)

#### `balances.ts` (pure)
A port of `group-debt-chart.tsx`'s `balances` memo: filters (status, view, lenders, borrowers) → a netted map `from->to` → sorted `BalanceEntry[]`. Port the web's tests plus: A owes B $10 and B owes A $4 → a single entry A→B $6.

#### `chart-series.ts`
A port of `apps/web/src/lib/chart-series.ts` (`bucketByMonth`) plus its test file `chart-series.test.ts` (copy the tests).

#### `recurring.ts`
Ports of `dashboard/format.ts` `getNextRenewalDate`, `getDaysUntil`, plus `upcomingWithin(payments, 7)` (0 ≤ days ≤ 7, sorted ascending), and `nextRenewal(payments)` (the earliest date, or `null`).

#### `splits.ts` (pure)
- `round2(n)`
- `buildReceiptAssignments(items, assignments)`: a port of `receipt-assignment-panel.tsx` `buildAssignments`. Each item's price is split equally across its assignees (`round2(price / n)`), summed per borrower, and the description is the item names joined with `, `.
- `perMemberTotals(items, assignments)` → `Map<memberId, number>`
- `splitEvenly(count)` → percentages summing to exactly 100.00, with the remainder added to the last entry (recurring form)
- `percentFromDollars(amount, total)` and `dollarsFromPercent(pct, total)` (recurring form links the % and $ fields, as on the web)
- `splitsValid(pcts)` → `Math.abs(sum - 100) <= 0.01`

#### `receipt-image.ts`
`pickReceipt(source: 'camera' | 'library'): Promise<{ uri, name, type: 'image/jpeg' } | null>`. It requests permission, launches the picker (`mediaTypes: ['images']`, `quality: 1`, `allowsEditing: false`), then runs `ImageManipulator` to resize so the long edge is ≤ 2048 px and save as JPEG at `compress: 0.7`. The result is a HEIC-safe JPEG, usually 300–900 KB. It rejects results over 4 MB. Returns `null` on cancel. On permission denied it shows an alert with a button that opens `Linking.openSettings()`.

#### `haptics.ts`
`success()`, `warning()`, `error()`, `selection()`, `light()`: thin wrappers over `expo-haptics` that do nothing when reduce-motion is on.

#### `action-sheet.ts`
`showActions({ title?, options: { label, destructive?, onPress }[] })` → iOS `ActionSheetIOS.showActionSheetWithOptions` (with Cancel added automatically); Android falls back to `Alert.alert` buttons.

#### `confirm.ts`
`confirm({ title, message, confirmLabel, destructive }): Promise<boolean>`, a promise wrapper around `Alert.alert`. It replaces the web's `AlertDialog` everywhere.

#### `responsive.ts`
`useBreakpoint()` → `'compact' | 'regular' | 'wide'` from `useWindowDimensions().width` (< 380, < 744, ≥ 744). `useContentWidth()` → `min(width, 720)` for centered content on iPad.

### B.5 `src/providers/`

| File | Contents |
|---|---|
| `AppProviders.tsx` | Nesting order: `GestureHandlerRootView(flex:1)` → `SafeAreaProvider` → `KeyboardProvider` → `QueryClientProvider(queryClient)` → `ThemeProvider` → `AuthProvider` → `{children}` + `<Toaster position="top-center" richColors={false} />` (sonner-native, themed to match Part C) + `<StatusBar style="auto" />`. |
| `AuthProvider.tsx` | Context `{ session, user (Supabase user), isLoading, signInWithPassword, signUp, signInWithApple, signInWithGoogle, signOut }`. On mount: `supabase.auth.getSession()` → set state → `isLoading=false`. Subscribes to `onAuthStateChange`. On `SIGNED_OUT`: `queryClient.clear()`. On `SIGNED_IN` with a `pendingAppleName` ref set → `userApi.updateName(name)` then clear the ref. The flows themselves are in §E.2. |
| `ThemeProvider.tsx` | Reads the stored preference (`AsyncStorage` key `bb.theme`: `system`/`light`/`dark`, default `system`) and applies it with NativeWind's `colorScheme.set()`. Exposes `{ preference, setPreference, resolved }`. Calls `SystemUI.setBackgroundColorAsync(tokens[resolved].background)`, so sheets and keyboard edges don't flash white in dark mode. |

### B.6 `src/hooks/`

#### `queries/`: one file per resource. Each exports hooks that wrap `useQuery` with the right key and endpoint.

| File | Hooks |
|---|---|
| `useMe.ts` | `useMe()` |
| `useCounts.ts` | `useCounts()` (`staleTime: 15s`, `refetchInterval: 60s` while the app is focused) |
| `useDashboard.ts` | `useDashboard()` |
| `useDebts.ts` | `useDebts(filters?)`, `useDebt(id)` (detail response), `useRequests()` |
| `useGroups.ts` | `useGroups()`, `useGroup(id)`, `useGroupDebts(id)` |
| `useInvites.ts` | `useInvites()` |
| `useFriends.ts` | `useFriends()`, `useIncomingRequests()`, `useSentRequests()`, `useFriendSearch(q)` (enabled when `q.trim().length ≥ 1`; debounced 250 ms in the caller), `useRecentFriends()` |
| `useTabs.ts` | `useTabs()` |
| `useAlerts.ts` | `useAlertsForMe()`, `useAlertsCreated()` |
| `useRecurring.ts` | `useRecurring(filters?)`, `useRecurringDetail(id)` |
| `useReceiptItems.ts` | `useReceiptItems(receiptId)` |
| `usePaypal.ts` | `usePaypalAccount()` → `GET /api/paypal/account` |

#### `mutations/`
Each exports hooks built on `useMutation`. They show the success toast and haptic, show the error toast (`errorMessage(e)`), and invalidate according to the §E.1.2 matrix. Optimistic updates are listed in §E.1.3.

| File | Hooks |
|---|---|
| `useDebtMutations.ts` | `useCreateDebt()`, `useSetDebtStatus()` (group screen) |
| `useRequestMutations.ts` | `useCreateRequest()` (confirm_paid / modify / drop), `useRespondRequest()`, `useCancelRequest()` |
| `useAlertMutations.ts` | `useCreateAlert()`, `useUpdateAlert()`, `useDeleteAlert()`, `useOptOutAlert()` |
| `useGroupMutations.ts` | `useCreateGroup()`, `useCreateGroupDebts()` (sequential creates, like the web's `createDebts`), `useAddFriendToGroup()` |
| `useInviteMutations.ts` | `useSendInvite()`, `useAcceptInvite()`, `useRejectInvite()`, `useCancelInvite()` |
| `useFriendMutations.ts` | `useAddFriend()`, `useAcceptFriend()`, `useRemoveFriendship()` (remove / cancel / reject, with the right toast copy per action) |
| `useTabMutations.ts` | `useCreateTab()`, `useUpdateTabStatus()`, `useDeleteTab()` |
| `useRecurringMutations.ts` | `useCreateRecurring()` (optionally followed by `createForRecurring` alert), `useToggleRecurring()`, `useDeleteRecurring()` |
| `useReceiptMutations.ts` | `useUploadReceipt()`, `useParseReceipt()`, `useLinkReceipt()`, `useDeleteReceipt()` |
| `useProfileMutations.ts` | `useUpdateName()`, `useDeleteAccount()` (then `signOut`) |
| `usePaypalMutations.ts` | `useConnectPaypal()`, `useDisconnectPaypal()`, `usePayDebtWithPaypal()` (the whole §E.6 flow as one mutation, exposing `stage: 'creating'\|'checkout'\|'capturing'\|'pending'\|'done'`) |

#### Other hooks
- `useRefreshOnFocus(keys)`: when the screen regains focus (`useFocusEffect`), refetches the given keys if they're stale. Skips the first mount.
- `useGroupMembershipRealtime()`: §E.5.
- `useDebounced(value, ms)`.

### B.7 `src/theme/`

| File | Contents |
|---|---|
| `tokens.ts` | `export const tokens = { light: {...}, dark: {...} }` with every hex value from §C.1, plus `radius`, `space`, and `chartPalette(scheme)`. A unit test parses `global.css` and checks every CSS variable equals the matching token, so the two can't drift apart. |
| `fonts.ts` | `export const fonts = { regular: 'Overpass_400Regular', medium: 'Overpass_500Medium', semibold: 'Overpass_600SemiBold', bold: 'Overpass_700Bold' }` and `typeScale` (§C.2). |
| `useThemeColors.ts` | `() => tokens[useColorScheme().colorScheme ?? 'light']` (NativeWind's `useColorScheme`). Used wherever a raw color is needed: charts, native header tint, `RefreshControl`, `ActivityIndicator`, `SegmentedControl`. |
| `header.ts` | Shared `NativeStackNavigationOptions` for tab stacks and detail screens (fonts, tint = `foreground`, large titles). |

### B.8 `src/components/`

#### `ui/`: primitives (mobile equivalents of `apps/web/src/components/ui/*`)

| Component | Props | Notes |
|---|---|---|
| `Text` | `variant: 'largeTitle'\|'title1'\|'title2'\|'title3'\|'headline'\|'body'\|'callout'\|'subhead'\|'footnote'\|'caption'`, `weight?: 'regular'\|'medium'\|'semibold'\|'bold'`, `tone?: 'default'\|'muted'\|'destructive'\|'positive'\|'negative'`, `tabular?: boolean`, `className` | The only text component. Maps weight → Overpass family and never sets `fontWeight`. `tabular` adds `fontVariant: ['tabular-nums']`. `maxFontSizeMultiplier` 1.6 (1.3 for `caption`). |
| `Button` | `variant: 'default'\|'secondary'\|'outline'\|'ghost'\|'destructive'`, `size: 'sm'\|'md'\|'lg'\|'icon'`, `loading`, `disabled`, `icon` (Lucide component), `onPress`, `haptic?` | `Pressable` with a pressed opacity/scale animation (Reanimated). Minimum height 44 (lg: 50). `loading` swaps the icon for a `Spinner` and disables the button. `accessibilityRole="button"`, `accessibilityState={{ disabled, busy: loading }}`. |
| `IconButton` / `HeaderButton` | `icon`, `label` (a11y), `badge?: number` | Header "+" and bell buttons; 44×44 hit area; badge dot shows `9+` above 9. |
| `Card` (+ `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) | `className` | `bg-card rounded-lg border border-border` (hairline via `StyleSheet.hairlineWidth` in light, 1 px in dark), padding 16. |
| `Badge` / `StatusBadge` | `variant` / `status` | `StatusBadge` copies the web's variant map exactly (`pending`→secondary, `paid`→outline, `approved`→outline, `rejected`→destructive, `cancelled`→outline, `active`→default, `inactive`→outline, `lending`→default, `borrowing`→secondary); capitalized label. |
| `Input` / `TextArea` | RN `TextInputProps` + `invalid` | Height 48, `rounded-md border-input`, placeholder `muted-foreground`, focus ring 2 px `ring`. |
| `MoneyInput` | `value: string`, `onChangeText`, `invalid` | `$` prefix, `keyboardType="decimal-pad"`, allows at most 2 decimals, shows a live formatted hint. |
| `Field` | `label`, `description?`, `error?`, `children` | Label (subhead, medium) + control + description (footnote, muted) or error (footnote, destructive); sets `accessibilityLabel` and `accessibilityHint`. |
| `Avatar` | `name`, `size: 28\|36\|44` | Circle with `initials()` on `muted`. Background color is picked from `chart-1..5` by a hash of the user id at 15% opacity (mobile-only touch). |
| `Empty` | `icon`, `title`, `description`, `action?` | Centered; copy mirrors the web's `Empty` states word for word (Part D). |
| `Skeleton` | `className` | Shimmer (Reanimated, 1.2 s loop, off when reduce-motion is on). |
| `Spinner` | `size` | `ActivityIndicator` tinted `muted-foreground`. |
| `Separator` | – | Hairline. |
| `Segmented` | `values: {value,label}[]`, `value`, `onChange` | Wraps `@react-native-segmented-control/segmented-control`; replaces the web's `Tabs` and `ToggleGroup`. |
| `ListRow` | `leading`, `title`, `subtitle`, `trailing`, `onPress`, `href`, `accessibilityLabel` | Table-cell layout, 60 pt min height, chevron when `href` is set; wraps `Link asChild` for navigation. |
| `SwipeableRow` | `actions: { label, icon, tone, onPress }[]` | `ReanimatedSwipeable` from gesture-handler; trailing actions only; a full swipe triggers the first action (with a haptic). |
| `SectionHeader` | `title`, `count?`, `action?` | Grouped-list section header (footnote, uppercase, muted), like the web's `SectionHeader`. |
| `StatTile` | `label`, `value: ReactNode`, `hint?`, `icon` | The web's `StatCard` equivalent: 2-column grid cell, value in `title2 tabular`. |
| `AnimatedAmount` | `value: number`, `format` | Counts up from the previous value in 400 ms (Reanimated shared value); no animation when reduce-motion is on. Replaces `@number-flow/react`. |
| `Banner` | `tone: 'default'\|'destructive'`, `title`, `description` | Replaces the web's `Alert` for form-level errors. |
| `FormSheet` | `title`, `description?`, `children`, `footer` | Scaffold for every `sheets/*` route: grabber, title row with Cancel, `KeyboardAwareScrollView`, sticky footer with the primary button above the keyboard. |
| `SelectMenu` | `value`, `options`, `onChange`, `label` | A button that opens `showActions`; replaces the web's `Select`. |
| `DateField` | `value: Date\|null`, `onChange`, `minimumDate` | `DateTimePicker` in `compact` display with a Clear button. |
| `ChipMultiSelect` | `options`, `selected`, `onChange` | Wrapping chips with checkmarks (the web's `MultiSelect`, used for receipt item assignees and group chart filters). |
| `Screen` | `children`, `refreshing`, `onRefresh`, `scroll?` | `ScrollView` with `contentInsetAdjustmentBehavior="automatic"` (required for large-title collapse), `RefreshControl`, 16 pt horizontal padding (20 when `regular`), iPad max width. |
| `OfflineBanner` | – | Shown under the header when `onlineManager.isOnline()` is false: "Offline — showing saved data". |

#### Feature components (each matches a web component)

| Folder / file | Web source it mirrors | What it renders |
|---|---|---|
| `auth/AuthForm.tsx` | `app/(auth)/auth-form.tsx` | Email/password form, validation, Apple + Google buttons, footer link |
| `auth/AppleButton.tsx` | new | `AppleAuthentication.AppleAuthenticationButton` (black / white by theme, corner radius 10, height 50) |
| `auth/GoogleButton.tsx` | `google-icon.tsx` | Outline button with the Google "G" (SVG) and "Continue with Google" |
| `dashboard/NeedsAttention.tsx` | `needs-attention.tsx` | Card listing approvals (→ Requests) and overdue alerts (→ debt); renders nothing when empty |
| `dashboard/DashboardStats.tsx` | `stat-cards.tsx` | 4 `StatTile`s |
| `dashboard/DebtBreakdown.tsx` | `debt-breakdown.tsx` | Donut (top 4 + Other), Segmented "Owed to you / You owe", legend with $ per slice |
| `dashboard/ActivityChart.tsx` | `activity-chart.tsx` | 6-month area chart, two series |
| `dashboard/UpcomingPayments.tsx` | `list-cards.tsx` (`UpcomingPaymentsCard`) | ≤ 3 rows due within 7 days, "View all" |
| `dashboard/GroupsPreview.tsx` | `list-cards.tsx` (`GroupsCard`) | ≤ 3 groups, "View all (n)" |
| `dashboard/TabsPreview.tsx` | `list-cards.tsx` (`TabsCard`) | ≤ 3 active tabs with a "Mark paid" button |
| `debts/DebtRow.tsx` | `debts-client.tsx` table row | Avatar, other party, description · group, date, signed amount, `StatusBadge`; swipe + "…" actions |
| `debts/DebtSummaryTiles.tsx` | Debts stat cards | 4 tiles |
| `debts/FriendPicker.tsx` | Friend combobox in `create-debt-modal.tsx` | Search field; "Recent friends" when empty; results; selected state |
| `debts/PendingRequestCard.tsx` | `debts/[id]/pending-request-card.tsx` | Request details + Approve / Reject / Cancel |
| `debts/ReminderCard.tsx` | `debts/[id]/reminder-card.tsx` | Reminder summary; Add/Edit (lender) or "Stop email reminders" (borrower) |
| `debts/ReceiptsCard.tsx` | `debts/[id]/receipts-card.tsx` | Thumbnail grid + "Add receipt" |
| `debts/ActivityCard.tsx` | `debts/[id]/activity-card.tsx` | Transaction history timeline; a PayPal badge on `confirm_paid` rows whose reason starts with "Paid with PayPal" |
| `paypal/PayWithPaypalButton.tsx` | backend.md §P.10 | Borrower's pay button with the stages from `usePayDebtWithPaypal` |
| `paypal/PaypalCard.tsx` | backend.md §P.10 | Profile card: Connect / Connected as {email} + Verified badge / Disconnect |
| `debts/RequestRow.tsx` | `debts/requests/requests-client.tsx` | Inbox row with inline Approve/Reject or Cancel |
| `groups/GroupCard.tsx` | `groups-client.tsx` cards | Name, member count, avatar stack |
| `groups/GroupStats.tsx` | group `StatCard`s | 4 tiles |
| `groups/GroupBalanceCard.tsx` | `group-debt-chart.tsx` | Netted "A → B $x" horizontal bars + filters |
| `groups/GroupSpendingCard.tsx` | `group-spending-chart.tsx` | 6-month area chart |
| `groups/GroupDebtsList.tsx` | `group-debts-list.tsx` | Segmented All/Pending/Paid with counts; rows with Mark paid/pending |
| `groups/MembersList.tsx`, `groups/PendingInvitesList.tsx` | `group-members.tsx` | Members; pending invites with Cancel (sender only) |
| `groups/DebtLineItem.tsx` | `groups/[id]/debt-form-item.tsx` | One row in "Add debts": member picker, amount, description, remove |
| `friends/FriendRow.tsx`, `friends/FriendRequestRow.tsx` | `friends-list.tsx`, `requests-list.tsx` | Rows with actions |
| `tabs/TabRow.tsx` | `tabs/tab-row.tsx` | Person, description, date, amount, status; Mark paid / Delete |
| `recurring/RecurringRow.tsx` | recurring list row | Description, cadence, amount, role, status, next renewal |
| `recurring/BorrowerSplitEditor.tsx` | `recurring-form-item.tsx` borrower rows | Email + % + $ (linked), add/remove row, "Split evenly", sum validation message |
| `alerts/AlertRow.tsx` | `alerts/alert-row.tsx` | Lender row with a frequency picker; borrower row with "Stop emails" |
| `alerts/FrequencyPicker.tsx` | `FREQUENCY_OPTIONS` | Segmented Off / Weekly / Biweekly / Monthly (values `null`/7/14/30) |
| `receipts/ReceiptThumb.tsx` | – | `expo-image` 88×88 rounded, `contentFit="cover"`, placeholder blur |
| `receipts/ItemAssignmentRow.tsx` | `receipt-assignment-panel.tsx` item row | Editable name + price, `ChipMultiSelect` of members, "$x each" |
| `charts/AreaChart.tsx` | recharts `AreaChart` | victory-native `CartesianChart` + `Area` + `Line` (monotone), month x-axis labels, press-and-hold tooltip (`useChartPressState`) |
| `charts/DonutChart.tsx` | recharts `PieChart` | victory-native `PolarChart` + `Pie.Chart` with inner radius 60% and the total in the center |
| `charts/BalanceBars.tsx` | recharts horizontal `BarChart` | Plain `View` bars (width ∝ amount / max); faster and more accessible than a canvas for ≤ 20 rows |


---

## Part C: Design system

**Principle:** same brand, same words, same information hierarchy as the web; the controls and layouts iOS users expect. The web is a neutral, shadcn-style monochrome UI with chart accents and the Overpass font. The app keeps that and adds a few mobile-only touches, listed in §C.7 so they're deliberate rather than drift.

### C.1 Color tokens

Converted from `apps/web/src/app/globals.css` (OKLCH → sRGB hex, computed, not eyeballed). React Native has no OKLCH support, so these hex values are the source of truth for mobile (`src/theme/tokens.ts`). `global.css` holds the same values as RGB triplets.

#### Light

| Token | Web OKLCH | Hex | RGB triplet | Used for |
|---|---|---|---|---|
| background | `1 0 0` | `#ffffff` | 255 255 255 | Screen background |
| foreground | `0.145 0 0` | `#0a0a0a` | 10 10 10 | Primary text, icons, native tint |
| card | `1 0 0` | `#ffffff` | 255 255 255 | Card surface |
| card-foreground | `0.145 0 0` | `#0a0a0a` | 10 10 10 | |
| primary | `0.205 0 0` | `#171717` | 23 23 23 | Primary button background |
| primary-foreground | `0.985 0 0` | `#fafafa` | 250 250 250 | Primary button label |
| secondary / muted / accent | `0.97 0 0` | `#f5f5f5` | 245 245 245 | Secondary button, badge, skeleton, pressed row |
| secondary/accent-foreground | `0.205 0 0` | `#171717` | 23 23 23 | |
| muted-foreground | `0.556 0 0` | `#737373` | 115 115 115 | Secondary text, placeholders |
| destructive | `0.577 0.245 27.325` | `#e7000b` | 231 0 11 | Destructive buttons, errors |
| border / input | `0.922 0 0` | `#e5e5e5` | 229 229 229 | Hairlines, input borders |
| ring | `0.708 0 0` | `#a1a1a1` | 161 161 161 | Focus ring |
| chart-1 | `0.646 0.222 41.116` | `#f54900` | 245 73 0 | Series 1 ("Owed to you") |
| chart-2 | `0.6 0.118 184.704` | `#009689` | 0 150 137 | Series 2 ("You owe") |
| chart-3 | `0.398 0.07 227.392` | `#104e64` | 16 78 100 | |
| chart-4 | `0.828 0.189 84.429` | `#ffb900` | 255 185 0 | |
| chart-5 | `0.769 0.188 70.08` | `#fe9a00` | 254 154 0 | |
| **positive** (mobile-only) | – | `#00786f` | 0 120 111 | Amounts owed **to** you (AA on white: 5.4:1) |
| **negative** (mobile-only) | = destructive | `#e7000b` | 231 0 11 | Amounts you owe |

#### Dark

| Token | Web OKLCH | Hex | RGB triplet |
|---|---|---|---|
| background | `0.145 0 0` | `#0a0a0a` | 10 10 10 |
| foreground | `0.985 0 0` | `#fafafa` | 250 250 250 |
| card | `0.205 0 0` | `#171717` | 23 23 23 |
| primary | `0.922 0 0` | `#e5e5e5` | 229 229 229 |
| primary-foreground | `0.205 0 0` | `#171717` | 23 23 23 |
| secondary / muted / accent | `0.269 0 0` | `#262626` | 38 38 38 |
| muted-foreground | `0.708 0 0` | `#a1a1a1` | 161 161 161 |
| destructive | `0.704 0.191 22.216` | `#ff6467` | 255 100 103 |
| border | `1 0 0 / 10%` | `#2e2e2e` (solid approximation of 10% white over `card`) | 46 46 46 |
| input | `1 0 0 / 15%` | `#383838` (solid approximation) | 56 56 56 |
| ring | `0.556 0 0` | `#737373` | 115 115 115 |
| chart-1 | `0.488 0.243 264.376` | `#1447e6` | 20 71 230 |
| chart-2 | `0.696 0.17 162.48` | `#00bc7d` | 0 188 125 |
| chart-3 | `0.769 0.188 70.08` | `#fe9a00` | 254 154 0 |
| chart-4 | `0.627 0.265 303.9` | `#ad46ff` | 173 70 255 |
| chart-5 | `0.645 0.246 16.439` | `#ff2056` | 255 32 86 |
| **positive** | – | `#00bc7d` | 0 188 125 |
| **negative** | = destructive | `#ff6467` | 255 100 103 |

Borders are solid (not translucent) because React Native hairlines over translucent colors render inconsistently between light and dark.

### C.2 Typography

**Font:** Overpass (the web's font), loaded from `@expo-google-fonts/overpass`: `Overpass_400Regular`, `_500Medium`, `_600SemiBold`, `_700Bold`. Numbers use `fontVariant: ['tabular-nums']` so amounts line up in columns (the web uses Geist Mono for that; one family is enough on mobile).

The iOS type ramp sizes at the default "Large" Dynamic Type setting. Everything scales with Dynamic Type (`allowFontScaling` stays on) up to `maxFontSizeMultiplier` 1.6.

| Variant | Size / line height | Weight | Used for |
|---|---|---|---|
| largeTitle | 34 / 41 | bold | Native large header titles (set via header options) |
| title1 | 28 / 34 | bold | Debt amount on the detail screen |
| title2 | 22 / 28 | semibold | Stat tile values, group name in cards |
| title3 | 20 / 25 | semibold | Card titles |
| headline | 17 / 22 | semibold | Row titles, button labels |
| body | 17 / 22 | regular | Body text, inputs |
| callout | 16 / 21 | regular | Secondary row text |
| subhead | 15 / 20 | regular / medium | Field labels, page descriptions |
| footnote | 13 / 18 | regular | Hints, timestamps, section headers (uppercase + 0.5 letter spacing) |
| caption | 12 / 16 | medium | Badges, chart axis labels |

Overpass sits slightly high in its line box (the web fixed this with metric overrides; commit `4261757`). In `Button` and `Badge`, add `paddingTop: 1` to labels and check alignment visually on both an iPhone SE and a Pro Max before signing off.

### C.3 Spacing, radius, layout

| Token | Value |
|---|---|
| Spacing scale | 4-pt grid: 4, 8, 12, 16, 20, 24, 32, 40 |
| Screen gutter | 16 (compact and regular), 20 on widths ≥ 428 |
| Card padding | 16; card-to-card gap 12; section gap 24 |
| Radius | sm 8 (badges, chips), md 10 (inputs, buttons; = web `--radius`), lg 14 (cards), xl 20 (large surfaces); sheets use the native radius |
| Hit target | ≥ 44×44 pt everywhere (`hitSlop` on small icons) |
| Row height | ≥ 60 pt for two-line rows, 48 for single-line |
| Stat grid | 2 columns on phones, 4 on `wide` (iPad), matching the web's `grid-cols-2 md:grid-cols-4` |
| iPad | Content max width 720 centered; Home and Group detail use 2 columns on `wide` (charts left, lists right), like the web's `xl:grid-cols-2` |

Breakpoints (`src/lib/responsive.ts`): `compact` < 380 (iPhone SE/mini), `regular` 380–743, `wide` ≥ 744 (iPad portrait and up). On `compact`, stat tiles drop the hint line and amounts use `title3` instead of `title2`.

### C.4 Elevation, surfaces, motion

- **Surfaces:** flat, as on the web. Cards are `card` + 1 px `border`, no shadow. Native sheets and headers use iOS materials (blur) automatically.
- **Pressed state:** rows get `accent` background; buttons scale to 0.97 and fade to 0.9 opacity (Reanimated, 120 ms).
- **Lists:** `LinearTransition` for reorders; `FadeIn.duration(150)` / `FadeOut.duration(120)` for insert and remove (optimistic deletes animate out).
- **Numbers:** `AnimatedAmount` counts up in 400 ms on Home and Debts tiles (the web's NumberFlow).
- **Skeletons:** shimmer that loops every 1.2 s.
- **Reduce Motion:** when `useReducedMotion()` is true, turn off count-up, shimmer, and layout animations (instant changes) and skip haptics.

### C.5 Haptics

| Event | Haptic |
|---|---|
| Segmented control or picker change | `selection` |
| Successful create / approve / accept / mark paid | `success` |
| Destructive confirmation shown | `warning` |
| Mutation failed | `error` |
| Full swipe triggers a row action | `light` |

### C.6 Icons

- In-app icons: `lucide-react-native` with **the same icon names as the web** (Plus, Bell, Inbox, CreditCard, Users, UserPlus, Receipt, RefreshCw, TrendingUp, TrendingDown, Scale, CheckCircle2, Pencil, Trash2, ArrowUpRight, ArrowDownLeft, CircleDollarSign, Camera, Image, Mail, Copy, LogOut, Sun, Moon, MoreHorizontal, ChevronRight). Size 20 in rows, 22 in headers; stroke width 2; color `foreground` or `muted-foreground`.
- Tab bar: SF Symbols (native): `house` / `house.fill`, `creditcard` / `creditcard.fill`, `person.3` / `person.3.fill`, `person.2` / `person.2.fill`, `ellipsis.circle` / `ellipsis.circle.fill`.
- App icon: the web brand (the "Broke Besties" wordmark has no mark yet). Designer deliverable: a 1024×1024 opaque PNG in the neutral palette, plus an optional dark variant. Placeholder until then: a white "B$" on `#171717`.

### C.7 How mobile differs from the web (on purpose)

| Web | Mobile | Why |
|---|---|---|
| Collapsible sidebar with 8 items + badges | Native tab bar: Home · Debts · Groups · Friends · More; badges on Debts (requests), Groups (invites), Friends (friend requests) | Thumb reach; iOS convention; 5 tabs is the iOS limit. Tabs, Recurring, Alerts, Profile, and Appearance live under **More**. |
| `PageHeader` (h1 + description + breadcrumbs + action buttons) | Native large-title header; description as the first line of content (subhead, muted); breadcrumbs → native back button with the parent title; actions → ≤ 2 header buttons (the rest go in a "…" menu) | Native scroll-collapse behavior |
| ⌘K command palette | "+" header button on Home/Debts/Groups/Friends → **Quick add** sheet. Per-list search → native header search bar | No keyboard shortcuts on phones |
| Tables with a row "…" menu | Rows with trailing swipe actions + a "…" button (action sheet) | Touch-first |
| `Dialog` for forms | Native form sheets (`presentation: 'formSheet'`) with detents and a grabber; long forms use a full-height page sheet | iOS convention; keyboard-safe |
| `AlertDialog` confirms | Native `Alert.alert` with a destructive style | Native look, VoiceOver support built in |
| `Tabs` / `ToggleGroup` filters | Native `UISegmentedControl` | Native look |
| `Select` | Button → action sheet; `<input type=date>` → native compact date picker | Native look |
| Hover tooltips on charts | Press-and-hold scrubbing tooltips | No hover on touch screens |
| Group "Debt overview" bar chart with multi-select lender/borrower dropdowns | Netted balance bars; filters behind a "Filter" button that opens a sheet with chips | Space |
| Amounts in monochrome with +/− | Same +/−, plus **positive (teal) / negative (red)** tint on amount text | Faster to scan on a small screen |
| Initials avatars in `muted` | Initials avatars tinted by a hash of the user id (chart palette at 15%) | Tell people apart at a glance |
| Landing page | Compact **Welcome** screen with the same hero copy and 3 steps | App-first |
| Toasts (sonner) | Toasts (sonner-native, top-center) **plus** haptics | Feedback without looking |
| Refresh = navigate | Pull-to-refresh on every list and detail; refetch on focus and on foreground | Mobile convention |

Everything else, including copy, empty states, validation messages, status names, and which actions are allowed when, is **identical** to the web. When in doubt, copy the web's string.

### C.8 Web → mobile component map

| Web (`components/ui`, shadcn) | Mobile (`src/components/ui`) |
|---|---|
| `Button` | `Button` (same variants: default, secondary, outline, ghost, destructive) |
| `Card*` | `Card*` |
| `Badge`, `StatusBadge` | `Badge`, `StatusBadge` (same variant map) |
| `Input`, `Textarea`, `Field*`, `InputGroup` | `Input`, `TextArea`, `Field`, `MoneyInput` |
| `Dialog`, `Sheet` | `FormSheet` route (expo-router form sheet) |
| `AlertDialog` | `confirm()` (`Alert.alert`) |
| `DropdownMenu` | `showActions()` (`ActionSheetIOS`) |
| `Select` | `SelectMenu` |
| `Tabs`, `ToggleGroup` | `Segmented` |
| `Command` (combobox) | `FriendPicker` / search field + list |
| `MultiSelect` | `ChipMultiSelect` |
| `Empty*` | `Empty` |
| `Skeleton`, `Spinner` | `Skeleton`, `Spinner` |
| `Item*` | `ListRow` |
| `Avatar` | `Avatar` |
| `Alert` | `Banner` |
| `Sonner` | `sonner-native` `Toaster` |
| `Chart*` (recharts) | `charts/AreaChart`, `charts/DonutChart`, `charts/BalanceBars` |
| `Sidebar`, `Breadcrumb`, `Collapsible` | Native tabs, native back button, `Pressable` disclosure row |
| `StatCard` | `StatTile` |
| `PageHeader` | Native header + `Screen` |

### C.9 Accessibility rules (must pass before TestFlight external)

1. Every `Pressable`/`Button`/`IconButton` has an `accessibilityLabel`. Icon-only buttons use the web's `aria-label` text ("Notifications", "Debt actions", "More actions").
2. Rows read as one element: "Lending, Alex Kim, Dinner, 42 dollars, pending". Use `accessibilityLabel` on `ListRow`. Swipe actions are also exposed as `accessibilityActions` (VoiceOver rotor).
3. Amount colors are never the only signal: the +/− sign and the Lending/Borrowing label stay.
4. Charts have an `accessibilityLabel` summary ("Activity over the last 6 months: owed to you 120 dollars, you owe 45 dollars"), and every chart has a text legend with values.
5. Contrast: every text/background pair ≥ 4.5:1 (large text ≥ 3:1). The token table meets this except chart colors used as text. Chart colors are for graphics only; never use them for text.
6. Dynamic Type: test at AX1 (the largest standard accessibility size). Rows wrap and don't truncate amounts; stat tiles stack into 1 column when the font scale is > 1.3.
7. Focus order follows visual order; sheets trap focus (native).


---

## Part D: Navigation and screens

### D.1 Information architecture

```
Root Stack
├── (auth)  [shown when signed out]
│   ├── welcome           S1
│   ├── login             S2
│   └── signup            S3
├── auth/callback         (OAuth fallback)
└── (app)   [shown when signed in]  ── Stack
    ├── (tabs)  ── NativeTabs
    │   ├── Home     (house)        → (home)/index            S5
    │   ├── Debts    (creditcard)   → (debts)/debts           S8   badge: counts.debtRequests
    │   ├── Groups   (person.3)     → (groups)/groups         S13  badge: counts.invites
    │   ├── Friends  (person.2)     → (friends)/friends       S17  badge: counts.friendRequests
    │   └── More     (ellipsis.circle) → (more)/more          S19
    │         └── pushed inside the More stack: tabs S20 · recurring S21 · alerts S23 · profile S24 · appearance S24b
    ├── debts/[id]           S9   (push, tab bar hidden)
    ├── debts/requests       S10  (push)
    ├── groups/[id]          S14  (push)
    ├── recurring/[id]       S22  (push)
    ├── invites              S16  (push)
    ├── notifications        S6   (form sheet)
    ├── quick-add            S7   (form sheet, fit to contents)
    ├── receipt-viewer       S12  (full-screen modal)
    ├── scan/ index, assign  S25, S26 (modal stack)
    └── sheets/*             S11, S15, S18, S20a, S21a, S24a (form sheets)
```

#### Route table and web equivalents

| Mobile route | Web URL | Screen |
|---|---|---|
| `/(auth)/welcome` | `/` (landing) | S1 |
| `/(auth)/login` | `/login` | S2 |
| `/(auth)/signup` | `/signup` | S3 |
| `/` (Home tab) | `/dashboard` | S5 |
| `/debts` | `/debts` | S8 |
| `/debts/[id]` | `/debts/[id]` | S9 |
| `/debts/requests` | `/debts/requests` (+ `/debt-transactions` redirect) | S10 |
| `/groups` | `/groups` | S13 |
| `/groups/[id]` | `/groups/[id]` | S14 |
| `/invites` | `/invites` | S16 |
| `/friends` | `/friends` | S17 |
| `/more` | – (sidebar) | S19 |
| `/tabs` | `/tabs` | S20 |
| `/recurring` | `/recurring-payments` | S21 |
| `/recurring/[id]` | `/recurring-payments/[id]` | S22 |
| `/alerts` | `/alerts` | S23 |
| `/profile` | `/profile` | S24 |
| `/scan` | `/ai` (receipt part) | S25–S26 |

Deep links (custom scheme; universal links are Phase 2): `brokebesties://debts/42`, `brokebesties://groups/7`, `brokebesties://invites`, `brokebesties://debts/requests`. Expo Router handles these automatically. When signed out, the link is stored and replayed after sign-in (`AuthProvider` saves the initial URL from `Linking.getInitialURL()` and calls `router.push` after `SIGNED_IN`).

### D.2 Presentation of modal routes (in `app/(app)/_layout.tsx`)

| Route | `presentation` | Detents | Header |
|---|---|---|---|
| `notifications` | `formSheet` | `[0.6, 1.0]`, grabber | Title "Notifications" |
| `quick-add` | `formSheet` | `'fitToContents'`, grabber | none (rendered in content) |
| `sheets/new-debt`, `sheets/group-add-debts`, `sheets/new-recurring` | `formSheet` | `[1.0]` (full height), grabber | Cancel left, title center; primary action in the sticky footer |
| `sheets/confirm-paid`, `sheets/modify-debt`, `sheets/delete-debt`, `sheets/reminder`, `sheets/new-group`, `sheets/group-invite`, `sheets/add-friend`, `sheets/new-tab`, `sheets/delete-account` | `formSheet` | `[0.75, 1.0]`, grabber | Same |
| `receipt-viewer` | `fullScreenModal` | – | Close (X) top right, black background |
| `scan` (stack) | `modal` | – | Cancel left, step title |

Sheet routes receive their context as params (e.g. `sheets/modify-debt?debtId=42`) and read the entity from the React Query cache (`queryClient.getQueryData`), falling back to fetching it. They never take whole objects as params.

### D.3 Screen specs

Each spec has the route, the web source it mirrors, **Data** (hooks → endpoints), **Layout** (top → bottom), **Actions**, **States**, and **Acceptance** (testable statements). Copy in quotes is exact and taken from the web.

---

#### S1: Welcome `(auth)/welcome`

- **Mirrors:** landing hero (`(marketing)/landing-client.tsx`).
- **Layout:** safe-area full screen, content centered vertically in the top 60%:
  1. Eyebrow (footnote, uppercase, muted): "Shared expenses, settled"
  2. Title (largeTitle): "Split the bill,\nkeep the friendship."
  3. Body (callout, muted): "Broke Besties tracks who paid, who owes, and what's recurring — across roommates, road trips, and dinner clubs."
  4. Three compact steps (icon + headline + one line): "Start a group", "Add what you spend", "Settle up" (web `steps` copy, shortened to one line each).
  5. Bottom-pinned buttons: `AppleButton` ("Continue with Apple"), `GoogleButton` ("Continue with Google"), Button default "Sign up with email" → `/signup`, Button ghost "I already have an account" → `/login`.
- **Acceptance:** Apple, Google, and email sign-up all reach Home. Legal footnote: "By continuing you agree to our Terms and Privacy Policy" (links open `expo-web-browser` to web pages; product must supply the URLs before external TestFlight).

#### S2: Log in `(auth)/login` · S3: Sign up `(auth)/signup`

- **Mirrors:** `app/(auth)/auth-form.tsx` (`COPY[mode]`).
- **Layout:** title ("Log in" / "Create an account"), description (web copy), `Banner` for form errors, `Field` Email (`keyboardType="email-address"`, `autoComplete="email"`, `textContentType="username"`, `autoCapitalize="none"`), `Field` Password (`secureTextEntry` with an eye toggle, `textContentType="password"` for login / `"newPassword"` for signup so iOS offers strong passwords and Keychain autofill), primary button ("Log in" / "Sign up"), divider "or", Apple + Google buttons, footer link ("Don't have an account? Sign up" / "Already have an account? Log in").
- **Validation (same as web):** email required ("Email is required."), must match `/^\S+@\S+\.\S+$/` ("Enter a valid email address."); password required ("Password is required."); on signup min 6 ("Password must be at least 6 characters."). Errors show under each field after the first submit attempt.
- **Actions:** submit → `auth.signInWithPassword` / `auth.signUp` (§E.2). Return key on email → focus password; on password → submit.
- **States:** a pending action disables the whole form and puts a spinner on the pressed button (web `pending: 'google' | 'email'`). Supabase errors show in the banner with the text as-is ("Invalid login credentials"). Sign-up with email confirmation turned on → replace the form with `Empty`: "Check your inbox", "We sent a confirmation link to {email}.", button "Back to log in".

---

#### S5: Home `(tabs)/(home)/index`

- **Mirrors:** `app/(app)/dashboard/*`.
- **Data:** `useDashboard()` → `GET /api/dashboard` (one request). Derived with `src/lib`: `lending = debts.filter(lender=me)`, `borrowing = debts.filter(borrower=me)`, `activeTabs = tabs.filter(status∈{lending,borrowing})`, `upcoming = upcomingWithin(recurringPayments, 7)`.
- **Header:** large title "Home". Right: `HeaderButton` Bell (badge = `pendingApprovals.length + alerts.filter(a => a.debt).length`) → `/notifications`; `HeaderButton` Plus (label "Quick add") → `/quick-add`.
- **Layout (single column; 2 columns on `wide`):**
  1. Greeting: title3 "Welcome back, {user.name || email}" + subhead muted "An overview of your debts and recurring payments".
  2. **Needs attention** card (hidden when empty). Title "Needs attention", description "Requests waiting on your approval and overdue payments". Approval rows: icon FileClock, title "{Payment confirmation|Modification|Deletion} · $X.XX" (+ " → $Y.YY" when `proposedAmount`), subtitle "Requested by {name}{ · reason}", trailing button "Review" → `/debts/requests`. Overdue rows: icon AlertTriangle, title "Overdue payment · $X.XX", subtitle "Owed to {lender}{ · message}{ · Due M/D/YYYY}", trailing "View debt" → `/debts/{id}`.
  3. **Stat grid** (2×2 `StatTile`): "You are owed" `AnimatedAmount(sum lending)`, TrendingUp; "You owe" `AnimatedAmount(sum borrowing)`, TrendingDown; "Active recurring" count, RefreshCw; "Next renewal" `shortDate(nextRenewal)` or "None", CalendarClock.
  4. **Debt breakdown** card: `Segmented` "Owed to you" / "You owe" (default: owed). `DonutChart` of pending debts grouped by other party; top 4 + "Other"; center label = total; legend rows "Name · $X" (the web shows `$` per slice). Empty: "No debts to show" / "Pending debts will appear here."
  5. **Upcoming payments** card: "View all" → `/recurring`. ≤ 3 rows: description or "Recurring payment", "$X · {In N days|Today|Tomorrow}", → `/recurring/{id}`. Empty: "Nothing due soon" / "No payments due in the next 7 days."
  6. **Activity over time** card: `AreaChart` of the last 6 months (`bucketByMonth(debts, 6, createdAt, { owed: lender=me ? amount : 0, owe: borrower=me ? amount : 0 })`), series "Owed to you" (chart-1) and "You owe" (chart-2). Empty: "Not enough activity yet" / "Your monthly trend shows up here as you add debts."
  7. **Your groups** card: ≤ 3 `GroupCard` rows → `/groups/{id}`; header link "View all (n)" → Groups tab. Empty: "No groups yet" / "Create a group to split shared costs." + button "Create group" → `/sheets/new-group`.
  8. **Your tabs** card: ≤ 3 active tabs; row trailing "Mark paid" (optimistic; toast "Tab marked as paid"); "View all" → `/tabs`. Empty: "No active tabs" / "Quick IOUs you track yourself show up here." + "Add tab" → `/sheets/new-tab`.
- **States:** first load → skeletons shaped like each card. Pull-to-refresh → refetch dashboard + counts. Error with no cache → `Empty` "Couldn't load your dashboard" + "Try again".
- **Acceptance:** numbers match the web dashboard for the same account; tapping every row goes where the web link goes; "Mark paid" on a tab updates the web's Tabs page after a refresh.

#### S6: Notifications `(app)/notifications` (sheet)

- **Mirrors:** `components/notifications-dropdown.tsx`.
- **Data:** same `useDashboard()` cache (`pendingApprovals`, `alerts.filter(a => a.debt)`).
- **Layout:** section "Needs your approval" (rows: "{Drop request|Payment confirmation|Modification request}", "{requester} · {shortDate}", "$amount" → close the sheet, then push `/debts/requests`); section "Overdue payments" (rows: "{description or 'Payment'} · $amount", "Owed to {lender}{ · Due date}" → `/debts/{id}`). Empty: "You're all caught up".

#### S7: Quick add `(app)/quick-add` (sheet)

- **Mirrors:** `components/command-menu.tsx` "Quick actions".
- **Layout:** a grid of 6 large tappable tiles (icon + label): "Add debt" → `/sheets/new-debt`, "Scan receipt" → `/scan`, "Create group" → `/sheets/new-group`, "Add friend" → `/sheets/add-friend`, "Add tab" → `/sheets/new-tab`, "New recurring" → `/sheets/new-recurring`. Tapping closes this sheet and opens the target (`router.dismiss()` then `router.push`).

---

#### S8: Debts `(tabs)/(debts)/debts`

- **Mirrors:** `app/(app)/debts/debts-client.tsx`.
- **Data:** `useDebts()` → `GET /api/debts` (all statuses); `useCounts()` for the requests badge.
- **Header:** large title "Debts"; search bar (`headerSearchBarOptions`, placeholder "Search debts…", hides on scroll); right: "Requests" `HeaderButton` (Inbox icon, badge = `counts.debtRequests`) → `/debts/requests`; Plus → `/sheets/new-debt`.
- **Layout:**
  1. Description: "Track money you've lent and borrowed."
  2. Horizontal 2×2 `DebtSummaryTiles`: "You are owed" ($, "{n} pending"), "You owe" ($, "{n} pending"), "Net balance" ("+$X"/"-$X", "in your favor"/"you owe more"), "Pending requests" (count, "awaiting approval"; tap → Requests).
  3. Toolbar: `Segmented` "All (n)" / "Lending (n)" / "Borrowing (n)"; to the right a `SelectMenu` status ("All statuses" / "Pending" / "Paid") and a sort button (ArrowUpDown icon) → action sheet "Newest first", "Oldest first", "Largest amount", "Smallest amount".
  4. `FlatList` of `DebtRow`: leading `Avatar(other)`, title `other.name || email`, subtitle "{description or '—'} · {group or 'No group'}", footnote date; trailing: `signedMoney(amount, direction)` (positive/negative tone) above a `StatusBadge`. Tap → `/debts/{id}`.
  5. Row actions (only when `status === 'pending'`), from swipe **and** from the "…" action sheet: "Mark as paid" → `/sheets/confirm-paid?debtId=`, "Modify" → `/sheets/modify-debt?debtId=`, "Delete" (destructive) → `/sheets/delete-debt?debtId=`. The action sheet also has "View details".
- **Filtering / sorting / search:** `filterDebts` + `sortDebts` from `src/lib/debts.ts` (the same rules as the web). Search matches other party name/email, description, and group name.
- **Empty:** icon Receipt, "No debts found"; description "Try adjusting your filters or search." when any filter is active, else "Add a debt to start tracking." plus an "Add debt" button.
- **Acceptance:** counts in the segment labels equal the number of rows under each filter; sort toggles work; an action on a paid debt isn't possible.

#### S9: Debt detail `(app)/debts/[id]`

- **Mirrors:** `app/(app)/debts/[id]/*`.
- **Data:** `useDebt(id)` → `GET /api/debts/:id` (`debt`, `transactions`, `receiptImageUrls`). `pendingTx = transactions.find(status==='pending')`; `isLender = debt.lenderId === me`; `canAct = canRequestChange(debt, pendingTx)`.
- **Header:** title = other party's name; back button "Debts" (or the previous screen). Right "…" (only when `canAct`): action sheet "Modify", "Delete" (destructive).
- **Layout:**
  1. **Hero card:** amount (title1, tabular, positive/negative tone with sign), `StatusBadge(status)`, direction line "You lent to {other}" / "You borrowed from {other}", description (body) or "No description", group row (Users icon + name, tappable → `/groups/{id}`) or "No group", "Created {longDate}".
  2. **Primary action row** (when `canAct`): Button default "Mark as paid" (CheckCircle2) → `/sheets/confirm-paid?debtId=`; **if `paypal.canPay`** (I'm the borrower and the lender connected PayPal), a full-width `PayWithPaypalButton` "Pay $X with PayPal" above it (§E.6); if I'm the borrower and `!paypal.lenderConnected`, footnote muted "{lender} hasn't connected PayPal yet". A payment in `APPROVED` state shows the banner "PayPal is processing your payment. We'll mark this debt paid when it clears."; Button outline "Request change" → action sheet (Modify / Delete). When `pendingTx` exists instead: footnote muted "Actions are unavailable while a request is pending."
  3. **PendingRequestCard** (when `pendingTx`): title = `transactionTypeLabel(type)`; "Requested by {You|name} · {shortDate}"; for `modify`: "Amount: $old → $new" and/or "Description: old → new"; reason (quoted); approval chips "Lender ✓"/"Lender pending" and "Borrower ✓"/"Borrower pending". Buttons:
     - I haven't approved (`isLender ? !lenderApproved : !borrowerApproved`) → "Reject" (outline) + "Approve" (default). Reject → `confirm("Reject this request?", "The request will be declined and the other party will be notified. They can submit a new request later.", "Reject request")`. Approving a `drop` → `confirm("Approve this deletion?", "This will permanently remove the $X debt. This cannot be undone.", "Approve deletion", destructive)`; then on success `router.back()` because the debt no longer exists.
     - I'm the requester → "Cancel request" (outline, destructive text) with a confirm.
  4. **ReminderCard:** title "Payment reminder" (Bell). Description: alert ? "Reminder set for this debt" : isLender ? "No reminder set" : "Only the lender can manage reminders". Lender: button "Add"/"Edit" → `/sheets/reminder?debtId=&alertId=`. When an alert exists, show "Message", "Deadline" (`longDate` or "None"), "Email reminders" (`frequencyLabel`). Borrower with active email reminders: text button "Stop email reminders" → `POST /api/alerts/:id/opt-out`, toast "You won't receive emails about this alert anymore".
  5. **ReceiptsCard:** title "Receipts" + count. Grid of `ReceiptThumb` (3 per row) from `receiptImageUrls`; tap → `/receipt-viewer?urls=[…]&index=i`. Button "Add receipt" → action sheet "Take photo" / "Choose from library" → `pickReceipt()` → `receiptsApi.upload(file, [debt.id])` → invalidate the debt. Empty: "No receipts yet" + "Attach a photo of the receipt."
  6. **ActivityCard:** title "Activity". A timeline of `transactions` (newest first): icon by type, "{typeLabel}" + `StatusBadge(status)`, "{requester} · {longDate}", reason. Empty: "No activity yet".
- **States:** 404 / 403 → `Empty` "Debt not found" + "Back to debts" (web `not-found.tsx`).
- **Acceptance:** the lender sees reminder controls and the borrower doesn't; a pending request blocks new requests; approving your side of a two-party request shows "Waiting on the other person" (toast "Approved — waiting on {other}") and leaves the debt unchanged until the other side approves.

#### S10: Requests `(app)/debts/requests`

- **Mirrors:** `debts/requests/requests-client.tsx`.
- **Data:** `useRequests()` → `GET /api/debt-transactions`; split with `needsMyApproval`.
- **Layout:** description "Approve or reject pending changes to your debts."; `Segmented` "Needs your approval (n)" / "Waiting on others (n)"; list of `RequestRow`: avatar(requester), title "{typeLabel} · $amount", details joined with " · " ("You requested" | "Requested by X", "With {other}", "$old → $new", "New description: …", reason), chips "Lender ✓/pending", "Borrower ✓/pending"; actions: "View debt" (ghost), and on the inbox tab "Reject" + "Approve" (same confirms as S9).
- **Empty:** inbox → "Nothing needs your approval" / "You're all caught up! New requests from friends will land here."; waiting → "Nothing waiting on others" / "Requests you have approved or created will wait here for the other party."; both with "Back to debts".
- **Acceptance:** after approve/reject the row leaves the inbox (optimistic) and the Debts tab badge drops by 1.

#### S11: Debt sheets

##### `sheets/new-debt` (mirrors `debts/create-debt-modal.tsx`)
Params: optional `groupId` (prefills the group), optional `borrowerId`.
Fields, in order:
1. **Borrower** (required): `FriendPicker`. With an empty query it shows "Recent friends" (`GET /api/friends/recent?limit=5`); typing searches (`GET /api/friends/search?q=`, debounced 250 ms). Rows: name + email; the selected one gets a check. Empty result: "No friends found." with a link "Add a friend" → `/sheets/add-friend`. When `groupId` is set, the picker lists **group members** (from `useGroup(groupId)`), minus me, instead of friends. That matches the group sheet on the web.
2. **Amount** (required): `MoneyInput`, placeholder "0.00", must be > 0.
3. **Description (optional):** placeholder "What is this debt for?".
4. **Group (optional):** `SelectMenu` from `useGroups()`; "No group" option; description "Assign to a group to share it with members."
5. **Receipt (optional):** "Attach receipt" row → camera/library; shows a thumbnail with remove (X).
6. **Add payment reminder** (collapsed disclosure row, like the web's `Collapsible`): Message (placeholder "e.g., Please pay by end of month"), Deadline (`DateField`, min today), "Email reminder frequency" `FrequencyPicker` (Off / Weekly / Biweekly / Monthly), description "Borrower receives an email reminder on this cadence."
Footer: Cancel / "Create debt" (disabled until borrower + valid amount).
Submit sequence (same as web):
1. If there's a receipt: `receiptsApi.upload(file)` → `receiptIds=[id]`
2. `debtsApi.create({ amount, description, borrowerId, groupId, receiptIds })`
3. If any reminder field is set: `alertsApi.createForDebt({ debtId, message: msg || null, deadline: iso || null, reminderFrequencyDays })`. A failure here is logged and does **not** fail the flow (web behavior).
4. Toast "Debt created", haptic success, dismiss, invalidate (§E.1.2). If step 2 fails after a receipt upload, delete the receipt.

##### `sheets/confirm-paid` (mirrors `confirm-paid-modal.tsx`)
Title "Mark as paid"; description "Confirm this debt has been settled."; summary rows Amount / Description (only if set) / {Borrower|Lender}; note "This will send a request to **{other}** to confirm this payment has been settled."; button "Mark as paid" → `requestsApi.create({ debtId, type: 'confirm_paid' })` → toast "Payment confirmation requested". Error → `Banner` "Something went wrong" + the message.

##### `sheets/modify-debt` (mirrors `modify-debt-modal.tsx`)
Title "Modify debt"; fields: Amount (prefilled), Description (prefilled), "Reason (optional)". Submit is enabled only when amount or description changed (`hasAmountChange || hasDescriptionChange`). Sends only the changed fields: `{ type:'modify', proposedAmount?, proposedDescription?, reason? }`. Note "This will send a request to **{other}** to approve these changes." Toast "Change request sent".

##### `sheets/delete-debt` (mirrors `delete-debt-modal.tsx`)
Title "Delete debt"; description "Request to remove this debt."; summary rows; "Reason (optional)"; note "This will send a request to **{other}** to approve the deletion."; destructive button "Request deletion" → `{ type:'drop', reason? }`. Toast "Deletion request sent".

##### `sheets/reminder` (mirrors `debts/[id]/reminder-card.tsx` dialog; also used by recurring detail)
Params `debtId` **or** `recurringPaymentId`, optional `alertId`. Fields: Message, Deadline (debts only), `FrequencyPicker`. Buttons: "Save" → create (`POST /api/alerts`) or update (`PUT /api/alerts/:id`) → toast "Reminder saved"; when editing, a destructive "Remove reminder" → confirm → `DELETE /api/alerts/:id` → toast "Reminder removed".

#### S12: Receipt viewer `(app)/receipt-viewer`
A horizontal paging `FlatList` of `expo-image`s, each inside a `ScrollView` with `maximumZoomScale={4}` (native pinch zoom on iOS), double-tap to zoom, black background, page indicator "2 of 3", Close button. Signed URLs expire after 1 h; on an image load error show "Couldn't load image" + "Retry", which refetches the debt query and re-reads the URLs.

---

#### S13: Groups `(tabs)/(groups)/groups`

- **Mirrors:** `groups/groups-client.tsx`.
- **Data:** `useGroups()`; `useInvites()` (count for the banner); realtime membership (§E.5).
- **Header:** large title "Groups"; search bar "Search groups…" (client-side name filter); right: Plus → `/sheets/new-group`.
- **Layout:** description "Split expenses with the people you share costs with."; if `invites.length > 0`, a banner row "You have {n} pending invite(s)" with "View" → `/invites` (the web's link to `/invites`); list of `GroupCard` (name, "{n} members", avatar stack of up to 4 members) → `/groups/{id}`.
- **Empty:** "No groups yet" / "You haven't joined any groups. Create one to get started." + "Create group".
- **Sheet `sheets/new-group`:** one field "Group name" (required, autofocus, return = submit), button "Create group" → `POST /api/groups` → toast `Group "{name}" created` → push `/groups/{id}`.

#### S14: Group detail `(app)/groups/[id]`

- **Mirrors:** `groups/[id]/*`.
- **Data:** `useGroup(id)` (members + pending invites), `useGroupDebts(id)`.
- **Header:** title = group name; right: Plus "Add debt" → `/sheets/group-add-debts?groupId=`; "…" → action sheet "Scan receipt" (→ `/scan?groupId=`, the mobile version of the web's "Create with AI"), "Invite member" (→ `/sheets/group-invite?groupId=`).
- **Layout:**
  1. Subtitle: "Created {M/D/YYYY} · {n} member(s)".
  2. `GroupStats` 2×2: "You owe" ($), "You're owed" ($), "Outstanding" ($, hint "All pending debts in this group"), "Members" (n).
  3. `Segmented` "Overview" / "Members".
  4. **Overview** (debts exist):
     - `GroupBalanceCard` "Debt overview": `Segmented` "All debts" / "You owe" / "Owed to you"; status chips "All / Pending / Paid" (default Pending); "Filter" button → sheet with two `ChipMultiSelect`s (Lenders, Borrowers; all selected by default; "(you)" suffix); `BalanceBars` rows "{from} → {to}" with amount; footer "Total: $X". Empty: "No balances to show".
     - `GroupSpendingCard` "Spending over time", "Total group debt added per month": `AreaChart` (6 months, one series).
     - `GroupDebtsList`: `Segmented` "All (n)" / "Pending (n)" / "Paid (n)"; rows: "{lender} → {borrower}", description, `StatusBadge`, date, amount; tap → `/debts/{id}`; action sheet: "View debt", then "Mark as paid" (pending) or "Mark as pending" (paid) → `PATCH /api/debts/:id { status }` (optimistic, reverted on error; toast "Debt marked as {status}"). **Same as the web: this is a direct status change, not a two-party request (backend.md Part A, "Web behaviors" note 1).**
  5. **Overview** (no debts): `Empty` "No debts yet" / "Track who owes who by adding the first debt to this group." / "Add the first debt".
  6. **Members** tab: `MembersList` (avatar, name, email, "(you)"); "Pending invites" section: rows `invitedEmail`, "Invited by {sender.email}"; if `invite.invitedBy === me` a "Cancel" action → confirm → `DELETE /api/invites/:id` → toast "Invite to {email} cancelled". Empty invites: "No pending invites". Button "Invite member".
- **States:** 404 → `Empty` "Group not found" + "Back to groups".

#### S15: Group sheets

##### `sheets/group-add-debts` (mirrors `create-debts-sheet.tsx` + `debt-form-item.tsx`)
Title "Add debts". Repeating `DebtLineItem` cards: **Borrower** (member picker: group members minus me), **Amount**, **Description (optional)**, remove button (hidden when only one line). "+ Add another" button. Footer shows the total ("{n} debts · $X") and "Create {n} debt(s)". Submit creates the debts **one by one** in order (`POST /api/debts` with `groupId`). On the first failure, stop, show the error toast, and keep the unsent lines. Success toast "Created {n} debt(s)".

##### `sheets/group-invite` (mirrors `invite-member-dialog.tsx`)
Title "Invite member". `Segmented` "Friends" / "Email".
- **Friends:** search field; with an empty query, recent friends (`/api/friends/recent`); otherwise `/api/friends/search`. Both lists have current members removed client-side. Row button "Add" → `POST /api/groups/:id/members { friendUserId }` → toast "{name} added to the group". Empty: "No friends to add".
- **Email:** email field → "Send invite" → `POST /api/invites` → toast "Invite sent to {email}". Server errors are shown as-is ("Invite already exists for this email", "User is already a member of this group").

#### S16: Group invites `(app)/invites`

- **Mirrors:** `invites/*`.
- **Data:** `useInvites()`.
- **Layout:** description "You have {n} pending invitation(s)." (or "Accept or decline invitations to join groups." when there are none); rows: group name (headline), "Invited by {sender.name}" (subhead), "{n} member(s)" · `shortDate`, buttons "Reject" (outline) + "Accept". Reject → confirm "Reject invite?" → `POST /api/invites/:id/reject` → toast "Invite rejected". Accept → `POST /api/invites/accept` → toast "Invite accepted" → push `/groups/{group.id}`.
- **Empty:** "No pending invites" / "When someone invites you to a group, it will show up here." + "View my groups" → Groups tab.

---

#### S17: Friends `(tabs)/(friends)/friends`

- **Mirrors:** `friends/*`.
- **Data:** `useFriends()`, `useIncomingRequests()`, `useSentRequests()`.
- **Header:** large title "Friends"; search bar "Search friends…" (client-side filter on the Friends segment); right: Plus → `/sheets/add-friend`.
- **Layout:** description "Manage your friends and friend requests."; `Segmented` "Friends (n)" / "Requests (n incoming)".
  - **Friends:** `FriendRow` avatar, name, email; "…" → "Remove friend" (destructive) → confirm "Remove friend?" / "{name} will be removed from your friends." → `DELETE /api/friends/:id` → toast "Friend removed". Empty: "No friends yet" + "Add friend".
  - **Requests:** section "Needs your response" (rows: requester name/email, "Reject" + "Accept"; Reject → confirm "Reject friend request?" → toast "Friend request rejected"; Accept → toast "Friend request accepted"). Empty: "No incoming requests" / "Friend requests sent to you will show up here." Section "Sent" (count) (rows: recipient name/email, "Cancel" → toast "Friend request cancelled"). Empty: "No sent requests" / "Requests you send will wait here until they are accepted."
- The URL param `?tab=requests` (from Home) opens the Requests segment.

#### S18: `sheets/add-friend`
Title "Add a friend"; description "Send a friend request by email."; Email field (placeholder "friend@example.com"); button "Send request" (disabled when empty) → `POST /api/friends { email }` → toast "You are now friends" if `autoAccepted`, else "Friend request sent". Errors are shown inline ("User not found", "Friend request already exists", ...).

---

#### S19: More `(tabs)/(more)/more`

Grouped list (iOS Settings style):
- **Money:** "Tabs" (Receipt) → `/tabs` (subtitle "{n} active"), "Recurring payments" (RefreshCw) → `/recurring`, "Reminders" (Bell) → `/alerts`.
- **People:** "Group invites" (Mail, badge = `counts.invites`) → `/invites`, "Debt requests" (Inbox, badge = `counts.debtRequests`) → `/debts/requests`.
- **Account:** header row with avatar + name + email → `/profile`; "Appearance" → `/appearance`.
- **About:** "Version {nativeApplicationVersion} ({nativeBuildVersion})" · update id (from `expo-updates`, when present); "Send feedback" → `mailto:` (TestFlight feedback also works through a screenshot).
- **Log out** (destructive text row) → confirm → `auth.signOut()`.

#### S20: Tabs `(tabs)/(more)/tabs`

- **Mirrors:** `tabs/*`.
- **Data:** `useTabs()` → `GET /api/tabs`.
- **Header:** title "Tabs"; right: Plus → `/sheets/new-tab`.
- **Layout:** description "Track money you lend or borrow outside the platform."; 3 `StatTile`s: "You owe" ($ sum borrowing), "You're owed" ($ sum lending), "Net" (±$); `Segmented` "Borrowing (n)" / "Lending (n)" / "Paid (n)"; `TabRow` list: avatar(personName), name + badge ("You owe" / "Owes you" / "Paid"), description, amount, "Added {longDate}"; trailing "Mark paid" when not paid (optimistic; toast "Marked your tab with {name} as paid"); swipe/"…": "Delete" (or "Remove" when paid) → confirm "{Delete|Remove} this tab?" / "This permanently deletes the $X tab with {name}. This action cannot be undone." → toast "Tab deleted".
- **Empty per segment:** copy from `tab-list.tsx`.

##### S20a `sheets/new-tab` (mirrors `create-tab-dialog.tsx`)
Title "Add new tab"; `Segmented` "I borrowed" / "I lent" (default borrowed); "Person" (placeholder "e.g. John, Mom, Coffee Shop", required); "Amount" (required > 0); "Description" (placeholder "e.g. Lunch last Tuesday", required); button "Add tab" → toast "Tab added".

#### S21: Recurring payments `(tabs)/(more)/recurring`

- **Mirrors:** `recurring-payments/recurring-payments-client.tsx`.
- **Data:** `useRecurring()` → `GET /api/recurring-payments`.
- **Layout:** description "Manage your recurring payments and subscriptions."; `Segmented` "All (n)" / "Lending (n)" / "Borrowing (n)"; `RecurringRow`: "$amount" + `namedCadence` or "every N days", `StatusBadge(active|inactive)` and a direction badge ("Lending"/"Borrowing"), description, "Lent by {you|lender} · {n} borrower(s)", "Next: {shortDate}"; lender rows have a trailing button "Deactivate"/"Activate" (→ `PATCH status`, optimistic; toast "Recurring payment activated"/"Recurring payment deactivated"), as on the web; tap → `/recurring/{id}`. Plus → `/sheets/new-recurring`. Empty: "Try adjusting your filters." when filtered.

##### S21a `sheets/new-recurring` (mirrors `recurring-form-item.tsx`)
Title "Create recurring payment". Fields: "Total amount" (required > 0); "Description" (placeholder "e.g., Netflix subscription, Utilities, etc."); "Frequency (days)" (numeric, ≥ 1, placeholder "30") with quick chips Weekly (7) / Biweekly (14) / Monthly (30); "Payment type" `Segmented` "For myself" / "For others" (description "You'll be both the lender and borrower" when self). For others: `BorrowerSplitEditor`: rows of Email (placeholder "user@example.com"), "Split %", and "$" (linked; editing one updates the other using the total); "+ Add borrower"; "Split evenly"; status line "Splits total 100%" or "Splits total {x}% — they must equal 100%" (destructive). Optional reminder disclosure: Message (placeholder "e.g., Monthly subscription reminder") + `FrequencyPicker`. Submit → `POST /api/recurring-payments { amount, description, frequency, borrowers: [{ email, splitPercentage }] }` (self → `[{ email: me.email, splitPercentage: 100 }]`), then optionally `POST /api/alerts { recurringPaymentId, … }`. If the alert fails: toast "Payment created, but the reminder could not be saved"; otherwise "Recurring payment created".

#### S22: Recurring detail `(app)/recurring/[id]`

- **Mirrors:** `recurring-payments/[id]/*`.
- **Data:** `useRecurringDetail(id)`.
- **Layout:** hero ("$amount", `cadenceText`, `StatusBadge`); **Details** card (Description, Frequency, Created, Next renewal, Lender); **Borrowers & splits** card (avatar, name/email, "{pct}% · $share"); **Reminder** card (same component as S9, with recurring params; no deadline field); lender-only actions: "Deactivate"/"Activate" (toast "Recurring payment deactivated"/"…activated") and "Delete" (destructive) → confirm "Delete this recurring payment?" → toast "Recurring payment deleted" → back. 404 → "Recurring payment not found".

#### S23: Reminders `(tabs)/(more)/alerts`

- **Mirrors:** `alerts/*`.
- **Data:** `useAlertsCreated()` (`?role=lender`), `useAlertsForMe()`; the "targeting you" list excludes alerts where I'm also the lender (web `borrowerOnly`).
- **Layout:** description "Manage how often we email reminders for your debts and recurring payments."; section "Alerts you created": `AlertRow` (borrower name, "$amount · {description}", deadline, `FrequencyPicker` inline → `PUT /api/alerts/:id { reminderFrequencyDays }` → toast "Email reminders turned off" / "Reminder frequency updated"; "View" → debt or recurring); empty "No alerts yet". Section "Alerts targeting you": rows (lender name, amount, deadline, current frequency) + "Stop emails" (only when frequency ≠ null) → opt-out → toast "You won't receive emails about this alert anymore"; empty "No reminders target you".

#### S24: Profile `(tabs)/(more)/profile`

- **Mirrors:** `profile/profile-client.tsx`.
- **Data:** `useMe()`.
- **Layout:** "Personal information" card: Name field (required) + "Save" / "Cancel" (enabled only when changed; toast "Profile updated"). "Account information" card: Email (with copy button; toast "Copied"), Member since (`longDate(createdAt)`), User ID (monospace, copy). **"PayPal" card** (`PaypalCard`): not connected → description "Connect PayPal so friends can pay you back in one tap." + button "Connect PayPal" (`useConnectPaypal`: `paypalApi.connectUrl()` → `WebBrowser.openAuthSessionAsync(url, `${scheme}://paypal/connected`)` → on `status=ok` toast "PayPal connected", on `reason=in_use` toast "That PayPal account is already linked to another Broke Besties account"); connected → "Connected as {email}" + "Verified" badge + "Disconnect" (confirm "Disconnect PayPal?" / "Friends won't be able to pay you with PayPal until you connect again."). "Log out" card: button "Log out". **"Delete account"** (destructive text button at the bottom) → `sheets/delete-account`.

##### S24a `sheets/delete-account` (new; App Store requirement)
Title "Delete account"; body: "This permanently deletes your Broke Besties account. You'll leave all groups, and your tabs and pending requests will be removed. Debts you share with other people stay in their history, showing “Deleted user”." Type `DELETE` to confirm (text field); destructive button "Delete my account" → `DELETE /api/user` → `signOut()` → Welcome with toast "Your account was deleted".

##### S24b Appearance `(tabs)/(more)/appearance`
Radio list "System" / "Light" / "Dark" (checkmark) → `ThemeProvider.setPreference`.

---

#### S25: Scan receipt, step 1 `(app)/scan/index`

- **Mirrors:** the receipt path of `ai/ai-client.tsx` (no chat, no premium needed).
- **Params:** optional `groupId`.
- **Layout:** title "Scan receipt"; "Group" `SelectMenu` (required; prefilled from the param; if the user has no groups → `Empty` "Create a group first" + "Create group"); two big buttons "Take photo" (Camera) and "Choose from library" (Image). After picking: a preview of the image and a progress state "Uploading…" → "Reading items…" (the spinner + step text replace the buttons).
- **Flow:** `pickReceipt()` → `receiptsApi.upload(file)` → `receiptsApi.parse(id)` (90 s timeout) → `router.replace('/scan/assign?receiptId=&groupId=')` with the parsed items passed through the React Query cache (`qk.receiptItems(id)` seeded with the parse result).
- **Errors:** upload/parse failure → `Banner` with the server message + "Try again"; the receipt is deleted if parsing failed (web behavior). 0 items parsed → "We couldn't find any items on this receipt." with "Try another photo" and "Enter manually" (→ assign screen with one empty item).

#### S26: Scan receipt, step 2 (assign) `(app)/scan/assign`

- **Mirrors:** `ai/receipt-assignment-panel.tsx`.
- **Data:** items from `qk.receiptItems(receiptId)`; members from `useGroup(groupId)` (all members, including me, as on the web).
- **Layout:** header "Assign items"; thumbnail of the receipt (tap → viewer); toolbar "{n} unassigned" badge, "Split all evenly" (assigns every member to every item), "Clear"; list of `ItemAssignmentRow`: editable name, editable price, `ChipMultiSelect` of members, "$x.xx each" when assigned; "+ Add item". Sticky footer: per-member totals ("Alex $12.50 · Sam $8.25 …", horizontally scrollable chips) and "Create {n} debt(s)".
- **Rules (same as the web):** each item's price is split equally among its assignees (`round2`); per-member amounts are summed; the description is the item names joined with ", "; **members assigned to items create debts where I'm the lender; if I assign items to myself, skip me** (a debt to yourself would be rejected with "Cannot create a debt to yourself"). The web sends it and shows the error; mobile filters it out up front and shows "Your share: $X (not recorded)".
- **Submit:** create debts sequentially (`POST /api/debts { amount, description, borrowerId, groupId }`), collect ids, then `PATCH /api/receipts/:id { debtIds }` (a link failure doesn't fail the flow). Toast "Created {n} debt(s)"; dismiss the scan modal; push `/groups/{groupId}`.
- **Cancel** (header): confirm "Discard this receipt?" → `DELETE /api/receipts/:id` → dismiss.

### D.4 Cross-cutting behavior on every screen

1. **Loading:** skeletons shaped like the content on first load. Background refetches never show a spinner (only the native pull-to-refresh spinner when the user pulls).
2. **Errors:** query error with no cached data → `Empty` with "Couldn't load {thing}" + "Try again". With cached data → keep showing it + an error toast once. Mutation errors → toast `errorMessage(e)` + `haptics.error()`.
3. **Offline:** `OfflineBanner`; mutation buttons disabled with the hint "You're offline".
4. **Keyboard:** every form uses `KeyboardAwareScrollView`; the primary button stays above the keyboard; return key advances fields.
5. **Double-submit protection:** every submit button is disabled while its mutation is pending.
6. **Session expiry:** a 401 after refresh signs out (§E.3) → the Welcome screen with toast "Your session expired. Please log in again."


---

## Part E: Data layer, auth, receipts, realtime

### E.1 Data layer (TanStack Query v5)

#### E.1.1 Query keys (`src/lib/query/keys.ts`)

| Key | Endpoint | staleTime | Notes |
|---|---|---|---|
| `['me']` | `GET /api/user` | 5 min | Profile, greeting fallback |
| `['counts']` | `GET /api/me/counts` | 15 s | Refetches every 60 s while the app is in the foreground; drives tab badges |
| `['dashboard']` | `GET /api/dashboard` | 30 s | Home + Notifications |
| `['debts','list',filters]` | `GET /api/debts` | 30 s | The Debts tab uses `filters = {}` (all) and filters on the client |
| `['debts','detail',id]` | `GET /api/debts/:id` | 30 s | Includes transactions + signed receipt URLs (valid 1 h, so refetch whenever staleTime has passed) |
| `['requests']` | `GET /api/debt-transactions` | 30 s | Requests inbox |
| `['groups','list']` | `GET /api/groups` | 60 s | Invalidated by realtime membership changes |
| `['groups','detail',id]` | `GET /api/groups/:id` | 60 s | Members + pending invites |
| `['groups','debts',id]` | `GET /api/groups/:id/debts` | 30 s | |
| `['invites']` | `GET /api/invites` | 30 s | |
| `['friends','list']` | `GET /api/friends` | 60 s | |
| `['friends','incoming']` | `GET /api/friends/requests` | 30 s | |
| `['friends','sent']` | `GET /api/friends/requests/sent` | 30 s | |
| `['friends','recent']` | `GET /api/friends/recent` | 60 s | Pickers |
| `['friends','search',q]` | `GET /api/friends/search?q=` | 60 s | `placeholderData: keepPreviousData` |
| `['tabs']` | `GET /api/tabs` | 30 s | |
| `['alerts','lender']` / `['alerts','borrower']` | `GET /api/alerts?role=lender` / `GET /api/alerts` | 30 s | |
| `['recurring','list',filters]` | `GET /api/recurring-payments` | 60 s | |
| `['recurring','detail',id]` | `GET /api/recurring-payments/:id` | 60 s | |
| `['receipt-items',id]` | `GET /api/receipts/:id/items` | ∞ | Seeded by the parse result during the scan flow |
| `['paypal','account']` | `GET /api/paypal/account` | 5 min | Profile PayPal card |

Keys are hierarchical, so invalidating `['debts']` refreshes both lists and details.

#### E.1.2 Invalidation matrix (what each mutation refreshes)

"D" = `['dashboard']`, "C" = `['counts']`. Run the invalidation in `onSettled`, so it happens after errors too.

| Mutation | Invalidate |
|---|---|
| Create debt (incl. group sheet, scan) | `['debts']`, `['groups','debts',groupId]`, D |
| Set debt status (group screen) | `['debts']`, `['groups','debts',groupId]`, D |
| Create request (confirm_paid / modify / drop) | `['debts','detail',debtId]`, `['requests']`, D, C |
| Respond to request | `['requests']`, `['debts']`, `['groups','debts']` (all), D, C. If `debtUpdated && type==='drop'` → `removeQueries(['debts','detail',debtId])` |
| Cancel request | `['requests']`, `['debts','detail',debtId]`, D, C |
| Create / update / delete alert | `['debts','detail',debtId]` or `['recurring','detail',id]`, `['alerts']`, D |
| Opt out of alert | `['alerts']`, `['debts','detail',debtId]`, D |
| Upload receipt to a debt | `['debts','detail',debtId]` |
| Link receipt | `['debts']` |
| Create group | `['groups','list']`, D |
| Add friend to group / send invite / cancel invite | `['groups','detail',groupId]` |
| Accept invite | `['invites']`, `['groups','list']`, D, C |
| Reject invite | `['invites']`, C |
| Add friend | `['friends']`, C |
| Accept / reject / cancel / remove friend | `['friends']`, C |
| Create / update / delete tab | `['tabs']`, D |
| Create / toggle / delete recurring | `['recurring']`, D |
| Update name | `['me']`, D |
| Connect / disconnect PayPal | `['paypal','account']` |
| PayPal capture completed (or 202 pending) | `['debts']`, `['requests']`, `['groups','debts']` (all), D, C |
| Delete account | `queryClient.clear()` (after sign-out) |

#### E.1.3 Optimistic updates (the ones the web does, plus list removals)

| Action | Optimistic change | On error |
|---|---|---|
| Tab → Mark paid | set `status='paid'` in `['tabs']` and in `['dashboard'].tabs` | Restore snapshot, toast |
| Tab → Delete | remove from `['tabs']` | Restore |
| Group debt → Mark paid/pending | set status in `['groups','debts',id]` | Restore, toast "Failed to update status" |
| Request → Approve / Reject | remove from the inbox part of `['requests']`; decrement `counts.debtRequests` | Restore |
| Friend request → Accept / Reject / Cancel; Remove friend | remove the row from the matching list | Restore |
| Invite → Accept / Reject | remove from `['invites']`; decrement `counts.invites` | Restore |
| Recurring → Activate / Deactivate | flip `status` | Restore |
| Alert → Change frequency | set `reminderFrequencyDays` | Restore |

Pattern (the same in every mutation hook):

```ts
useMutation({
  mutationFn: (id: number) => tabsApi.update(id, { status: 'paid' }),
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: qk.tabs });
    const prev = queryClient.getQueryData<Tab[]>(qk.tabs);
    queryClient.setQueryData<Tab[]>(qk.tabs, (old) => old?.map((t) => (t.id === id ? { ...t, status: 'paid' } : t)));
    return { prev };
  },
  onError: (e, _id, ctx) => { queryClient.setQueryData(qk.tabs, ctx?.prev); toast.error(errorMessage(e)); haptics.error(); },
  onSuccess: (tab) => { toast.success(`Marked your tab with ${tab.personName} as paid`); haptics.success(); },
  onSettled: () => { queryClient.invalidateQueries({ queryKey: qk.tabs }); queryClient.invalidateQueries({ queryKey: qk.dashboard }); },
});
```

#### E.1.4 Refresh triggers
- Pull-to-refresh: `refetch()` on the screen's queries (and `['counts']`).
- App returns to the foreground: React Query's `focusManager` refetches stale **active** queries.
- Screen regains focus (navigating back): `useRefreshOnFocus` refetches stale queries for that screen.
- Reconnect: `onlineManager` refetches.

### E.2 Auth

#### E.2.1 Session model
- `supabase-js` owns the session (access token ~1 h, refresh token). It's stored in the Keychain through `secureStorage` (§B.4).
- `AuthProvider` exposes `session`. `Stack.Protected` in `app/_layout.tsx` switches between `(auth)` and `(app)` whenever `session` changes. There's no manual redirect code.
- The API client reads the current access token for every request (`getSession()` returns the cached one and refreshes it if expired).
- **Log out** uses `supabase.auth.signOut({ scope: 'local' })`. That ends the session on this device only, so logging out on the phone doesn't log the user out of the website.

#### E.2.2 Email + password

```ts
// Log in
const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
// Sign up
const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
if (!error && !data.session) setAwaitingConfirmation(true); // "Confirm email" is on in Supabase
```
The DB trigger creates the `User` row (name = email prefix). Errors show in the form `Banner` exactly as Supabase returns them.

#### E.2.3 Sign in with Apple (native)

Show the button only when `await AppleAuthentication.isAvailableAsync()` is true.

```ts
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

async function signInWithApple() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!cred.identityToken) throw new Error('Apple did not return an identity token');
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ').trim();
    if (name) pendingAppleName.current = name;              // Apple only sends the name the FIRST time
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: rawNonce });
    if (error) throw error;
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return;         // user closed the sheet: no error
    throw e;
  }
}
// AuthProvider, on SIGNED_IN: if pendingAppleName.current → userApi.updateName(it) → clear it.
```

Requires B2 (trigger fix) and B14 (Apple provider with bundle ids as Client IDs). `ios.usesAppleSignIn: true` in `app.config.ts` adds the entitlement; EAS enables the capability on the App ID during credential setup.

#### E.2.4 Google (system browser OAuth + PKCE)

This reuses the Google provider the web already has, so no iOS Google client is needed.

```ts
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ path: 'auth/callback' }); // brokebesties[-dev|-preview]://auth/callback
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo); // ASWebAuthenticationSession
  if (result.type !== 'success') return;                                       // cancelled / dismissed
  const url = new URL(result.url);
  const errDesc = url.searchParams.get('error_description');
  if (errDesc) throw new Error(errDesc);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Google sign-in did not return a code');
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
```
`flowType: 'pkce'` (set in `src/lib/supabase.ts`) stores the code verifier in `secureStorage` between the two calls. The redirect URL must be in the Supabase allow-list (B14).

#### E.2.5 After any sign-in
1. `onAuthStateChange('SIGNED_IN')` → `Stack.Protected` swaps to `(app)`.
2. Prefetch `['dashboard']` and `['counts']` so Home renders from cache.
3. If a deep link was stored before sign-in, `router.push` it.
4. If `GET /api/user` returns 404 (the `User` row is missing because a trigger failed), sign out and show the toast "We couldn't finish setting up your account. Please try again." Also log it (release.md §A.6).

#### E.2.6 Session expiry and errors
- A 401 from the API → one `refreshSession()` → retry → a second 401 → `signOut({ scope:'local' })` → toast "Your session expired. Please log in again." (Part B `api/client.ts`).
- `TOKEN_REFRESHED` needs no handling: the next request picks up the new token.
- An `onAuthStateChange('SIGNED_OUT')` from anywhere → `queryClient.clear()`, so the next user never sees cached data from the previous one.

### E.3 API error handling rules

| Status | UI |
|---|---|
| 0 (network / timeout) | Toast "You're offline. Check your connection and try again."; keep cached data |
| 400 / 403 / 404 on a mutation | Toast with the server's `error` string (they're human-readable, see backend.md Part C); on forms, show it in the `Banner` instead |
| 403 / 404 on a detail query | The screen's not-found `Empty` state |
| 401 | Refresh + retry, then sign out (§E.2.6) |
| 5xx | Toast "Something went wrong. Please try again."; queries retry twice with backoff |

### E.4 Receipt pipeline

```
pick (camera | library)
  → ImageManipulator: resize long edge ≤ 2048 px, JPEG compress 0.7   (HEIC → JPEG, ~0.3–0.9 MB)
  → guard: size ≤ 4 MB (Vercel body limit 4.5 MB)
  → POST /api/receipts/upload  (multipart: file={uri,name:'receipt.jpg',type:'image/jpeg'} [, debtIds])
       ↳ returns { id, signedUrl }
  ├─ Attach-to-debt path (debt detail, new-debt sheet): done. The debt query refetches → thumbnails show
  └─ Scan path:
       → POST /api/receipts/:id/parse   (timeout 90 s; shows "Reading items…")
            ↳ { items: [{name, price}], rawText }
       → assign screen (edit items, assign members)
       → POST /api/debts × N (sequential; groupId set; I'm the lender; skip me as borrower)
       → PATCH /api/receipts/:id { debtIds }   (a failure is logged, not fatal)
```

**Cleanup rules (no orphaned receipts):**
- Parse fails → `DELETE /api/receipts/:id`.
- User cancels the scan before creating debts → `DELETE /api/receipts/:id` (confirm first).
- New-debt sheet: upload succeeded but debt creation failed → `DELETE /api/receipts/:id`.
- App killed mid-flow → the receipt stays pending (visible only to its uploader after B3). This is acceptable for v1; a nightly cleanup is a backend follow-up.

**Why the receipt isn't parsed on the device:** the parser (`src/agents/ReceiptItemParser.ts`, Gemini) holds the Google API key. It must stay on the server.

### E.5 Realtime (group membership)

Mirrors `groups-client.tsx`: subscribe to `GroupMember` changes, which RLS limits to the user's own rows (`migrations/20260618000002_groupmember_rls`). Result: when someone accepts your invite or adds you to a group from the web, your Groups list updates live.

```ts
export function useGroupMembershipRealtime() {
  const { session } = useAuth();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: qk.groups.all });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
      queryClient.invalidateQueries({ queryKey: qk.counts });
    };
    let channel = subscribe();
    function subscribe() {
      return supabase
        .channel(`group-members-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'GroupMember' }, refresh)
        .subscribe();
    }
    // iOS suspends sockets in the background: resubscribe + refresh on foreground.
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      supabase.removeChannel(channel);
      channel = subscribe();
      refresh();
    });
    return () => { sub.remove(); supabase.removeChannel(channel); };
  }, [userId]);
}
```
No filter on the subscription. The web notes that Supabase Realtime's filter parser doesn't match Prisma's camelCase `"userId"` column; the RLS policy added later already limits delivered rows to the user's own memberships.

### E.6 PayPal pay flow (mobile)

Backend side: backend.md Part B. Only borrowers see the button, and only when `debt.paypal.canPay` is true.

```ts
async function payDebtWithPaypal(debtId: number, setStage: (s: Stage) => void) {
  setStage('creating');
  let order: { paymentId: string; approveUrl: string };
  try {
    order = await paypalApi.createOrder(debtId);
  } catch (e) {
    // 409 "payment in progress" carries approveUrl: resume it instead of failing
    const resume = e instanceof ApiError && e.status === 409 && (e.body as any)?.approveUrl;
    if (!resume) throw e;
    order = { paymentId: (e.body as any).paymentId, approveUrl: resume };
  }
  setStage('checkout');
  const returnUrl = `${scheme}://paypal/return`;                 // scheme from Constants.expoConfig.scheme
  const res = await WebBrowser.openAuthSessionAsync(order.approveUrl, returnUrl);
  if (res.type !== 'success') { setStage('idle'); return; }     // user closed checkout: nothing charged
  const status = new URL(res.url).searchParams.get('status');
  if (status !== 'approved') { setStage('idle'); toast('Payment cancelled'); return; }
  setStage('capturing');
  const { payment } = await paypalApi.capture(order.paymentId);
  setStage(payment.status === 'COMPLETED' ? 'done' : 'pending');
}
```

UI per stage (inside `PayWithPaypalButton`):

| Stage | Button / feedback |
|---|---|
| idle | "Pay $X with PayPal" (follow PayPal's brand guidelines: use their official mark from PayPal's brand assets and don't recolor it) |
| creating / capturing | Spinner + "Opening PayPal…" / "Confirming payment…"; button disabled |
| checkout | Button disabled while the auth browser is open |
| done | `haptics.success()`, toast "Paid {lender} $X with PayPal", invalidate (§E.1.2); the debt now shows **Paid** and the Activity row "Payment confirmation · Paid with PayPal" |
| pending | Banner "PayPal is processing your payment. We'll mark this debt paid when it clears." (the webhook finishes it; a refetch on focus picks it up) |
| error | Toast with the server message (402 → "PayPal declined the payment method. Try again with a different one."); the button goes back to idle |

Rules: never show a "paid" state before the capture response or the refetched debt says so. Never retry capture more than once automatically; the backend call is idempotent, so pull-to-refresh is safe. Offline → button disabled like every mutation.

### E.7 Local persistence

| Data | Where | Why |
|---|---|---|
| Supabase session (tokens) | Keychain (`expo-secure-store`, chunked) | Secret |
| Theme preference | AsyncStorage `bb.theme` | Not secret |
| Last-used group in Scan | AsyncStorage `bb.scan.lastGroupId` | Convenience |
| React Query cache | Memory only in v1 | Phase 2: `@tanstack/query-async-storage-persister` for an instant offline cold start (never persist `['me']` or anything with signed URLs) |

Nothing else is stored on the device. Receipt images are passed by URI from the picker's cache and never copied elsewhere.
