# Expo HAS CHANGED

This project is pinned to **Expo SDK 54** (`expo ~54.0.0`, RN 0.81, React 19.1). Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code. Do not use v57+ docs or assume newer APIs exist.

## Commands

- Verify before finishing: `npm run lint` -> `npm run type-check` -> `npm run format:check` (all have `npm run`-only names; type-check uses a hyphen, not a colon)
- `npm run lint:fix` and `npm run format` (auto-fix) are available
- Note: `format`/`format:check` only cover `src/**`, NOT `app/`
- Dev: `npm start`, `npm run android|ios|web`
- `npm run prebuild` = `expo prebuild --clean` — destructively regenerates the gitignored `ios/`/`android/` folders
- No test framework is installed; there are no tests

## Architecture (not obvious from filenames)

- Entry is `app/index.tsx` (`main: expo-router/entry`) with NO `_layout.tsx` and no other route files. Navigation is manual React Navigation, not expo-router file routing. Add screens under `src/screens/` and register them in `src/navigation/BottomTabNavigator.tsx` + `src/navigation/types.ts` (RootStackParamList / TabParamList).
- Zustand stores in `src/store/` are **in-memory only** — they hydrate from and write through to SQLite via `src/services/dbService.ts` (expo-sqlite, DB file `keuangan.db`).
- expo-sqlite is a native module: the app needs a dev build (`npx expo run:android`), it will NOT work in Expo Go. The `Transaction` SQL table name must be quoted as `"Transaction"` (SQLite reserved keyword).
- `react-native-get-random-values` must be imported before `uuid` (already done at the top of `app/index.tsx`) — keep any new uuid usage after it.
- Gemini integration (`src/services/geminiService.ts`) reads the API key at call time via `src/services/keyService.ts`: priority is `expo-secure-store` (set from Settings screen) → fallback `process.env.EXPO_PUBLIC_GEMINI_API_KEY`. `isGeminiConfigured()` is async. env vars need the `EXPO_PUBLIC_` prefix to be inlined; configure via `.env` (gitignored; `.env.example` is the template).
- Path aliases: `@/*` -> `src/*`, `@/assets/*` -> `assets/*`.
- `app.json` enables `experiments.typedRoutes` and `experiments.reactCompiler` — respect React Compiler constraints.
- UI strings are a mixed Indonesian/English; the product targets id-ID / IDR. Match the file you're editing.

## Conventions

- Prettier: single quotes, semicolons, printWidth 100, trailingComma es5, `endOfLine: auto` (repo uses CRLF on Windows via git `core.autocrlf`). ESLint uses a flat config `eslint.config.js` (typescript-eslint recommended + `prettier/prettier` as error, `no-console`/`no-unused-vars` as warnings; `no-explicit-any` and `no-require-imports` are off to match legacy behavior).
- Styling is RN `StyleSheet` (no NativeWind/Tailwind). Brand colors live in `src/constants/index.ts` (primary `#208AEF`, success `#4caf50`, error `#ff6b6b`), though screens often hardcode them.
- `docs/` (PRD, IMPLEMENTATION-CHECKLIST, GEMINI-INTEGRATION-GUIDE, etc.) is maintained to match the current SQLite-based code. Trust code first, but docs are kept accurate.

Existing instruction sources: `CLAUDE.md` just includes this file. `README.md` is the up-to-date setup/architecture reference (SQLite). `docs/` is kept in sync with the code.
