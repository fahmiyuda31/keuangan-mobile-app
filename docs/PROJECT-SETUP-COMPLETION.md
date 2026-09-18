# Keuangan Mobile App - Project Setup (Current State)

**Status**: SET UP — SQLite persistence working, dev build required
**Date**: 2026-09-18
**Reference**: `README.md` is the source of truth. Older content in this file (Realm, RN 0.86, Expo SDK 57, NativeWind, chart-kit) is obsolete.

---

## Stack (as installed)

| Component | Version |
|-----------|---------|
| Expo | ~54.0.0 |
| React Native | 0.81.5 |
| React | 19.1.0 |
| TypeScript | ~5.9.2 |
| expo-sqlite | ~16.0.0 |
| expo-secure-store | ~15.0.8 |
| Zustand | ^5.0.14 |
| React Navigation (bottom-tabs / native-stack) | 7.x |
| react-native-safe-area-context | ~5.6.0 |
| react-hook-form + zod | ^7 / ^4 (forms) |
| ESLint | ^10.7.0 (flat config) |
| Prettier | ^3.9.6 |

Not used (older docs mention them — do not assume): Realm, axios, `@google/generative-ai`, nativewind/tailwind, expo-av.
The current project uses `react-native-chart-kit`, `expo-camera`, `expo-image-picker`,
`@react-native-async-storage/async-storage`, and `eslint-config-expo`.

---

## Folder structure (actual)

```
app/index.tsx               # entry (expo-router/entry) + app init + providers
src/
  database/models/          # TS interfaces: Transaction, Category, Budget
  services/
    dbService.ts            # SQLite CRUD (expo-sqlite) — ACTIVE
    geminiService.ts        # AI parsing, receipt OCR, and financial chat (Gemini)
    keyService.ts           # Gemini key: SecureStore -> .env fallback
  store/                    # Zustand: transaction, category, budget, app
  navigation/               # types.ts, index.tsx, BottomTabNavigator.tsx
  screens/                  # dashboard, transactions, categories, budgets, Settings
  components/ui/            # Button, Card, Input, Modal
  constants/                # brand colors, etc.
```

## Database

- File: `keuangan.db` (expo-sqlite, `openDatabaseSync`)
- Tables: `"Transaction"` (quoted — reserved keyword), `Category`, `Budget`
- No encryption and no Realm; schema migrations use `PRAGMA user_version`
- Native modules → dev build required (`npm run prebuild`, then `npm run android|ios`); does not run in Expo Go

## Gemini key flow

`keyService.getGeminiKey()` at call time:
1. `expo-secure-store` (`gemini_api_key`) — set from Settings screen
2. `process.env.EXPO_PUBLIC_GEMINI_API_KEY` — fallback

## NPM scripts

```bash
npm start          # dev server
npm run android    # dev build on Android
npm run ios        # dev build on iOS
npm run web        # web
npm run lint       # eslint (flat config)
npm run lint:fix
npm run format     # prettier write (src/** only)
npm run format:check
npm run type-check # tsc --noEmit
npm run prebuild   # expo prebuild --clean (destructive)
```

## Verification

```bash
npm run lint
npm run type-check
npm run format:check
```

---

**Last Updated**: 2026-09-18
