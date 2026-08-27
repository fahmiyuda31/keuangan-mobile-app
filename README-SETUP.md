# Keuangan Mobile App

A mobile personal finance app built with React Native and Expo SDK 54. Track expenses, manage categories, set budgets, and maintain control over your personal finances with ease.

## Features (MVP Phase 1)

- **Dashboard**: Overview of income, expenses, and balance
- **Transactions**: View, add, and manage financial transactions
- **Categories**: Organize transactions with customizable categories
- **Budgets**: Set and track budgets for different spending categories
- **Settings**: Configure preferences, including the Gemini API key
- **Offline Support**: Full offline capability with local SQLite database
- **Cloud Backup**: Manual Firebase (Firestore) backup/restore with email/password auth (`src/services/firebaseService.ts`)
- **Login**: App gated behind email/password sign-in (`src/screens/AuthScreen.tsx`)

## Project Structure

```
keuangan-mobile-app/
├── app/                          # Expo Router entry (app/index.tsx)
├── src/
│   ├── components/               # UI + feature components
│   ├── database/
│   │   └── models/               # TypeScript interfaces (Transaction, Category, Budget)
│   ├── navigation/               # React Navigation config (manual, not expo-router routing)
│   ├── screens/                  # dashboard/, transactions/, categories/, budgets/, Settings
│   ├── services/
│   │   ├── aiService.ts          # Hybrid AI Router (On-Device + Cloud fallback)
│   │   ├── onDeviceAiService.ts  # On-Device Gemma 4 E2B offline engine (llama.rn)
│   │   ├── geminiService.ts      # Cloud AI transaction parsing & chat (Gemini)
│   │   ├── keyService.ts         # Gemini key lookup (SecureStore -> .env fallback)
│   │   ├── dbService.ts          # SQLite CRUD (expo-sqlite) - the active DB layer
│   ├── store/                    # Zustand stores (transactionStore, categoryStore, budgetStore, modelStore)
│   ├── utils/                    # Utility functions
│   └── constants/                # App constants
├── assets/
├── .env.example                  # Environment variables template
├── app.json                      # Expo app configuration
├── eslint.config.js              # Flat ESLint config (typescript-eslint + prettier)
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Framework**: React Native + Expo SDK 54 (RN 0.81, React 19.1)
- **Language**: TypeScript
- **State Management**: Zustand
- **Database**: expo-sqlite (local, offline-first)
- **Cloud backup**: Firebase JS SDK v12 (Firestore + Auth email/password, `@react-native-async-storage/async-storage` for auth persistence)
- **Navigation**: React Navigation (bottom tabs + native stack)
- **Code Quality**: ESLint (flat config) + Prettier

## Installation

### Prerequisites

- Node.js 18+
- Android: Android Studio + SDK (native modules need a dev build)
- iOS: Xcode + CocoaPods

### Setup Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup environment variables** (optional — only needed as fallback key)
   ```bash
   cp .env.example .env
   ```

3. **Prebuild (required — expo-sqlite/expo-secure-store are native modules, Expo Go won't work)**
   ```bash
   npm run prebuild
   ```

4. **Run on your device**
   ```bash
   npm run android   # dev build
   # or: npm run ios
   # or: npm start   # then press a / i / w
   ```

## Development Commands

```bash
npm start            # Start development server
npm run android      # Run on Android (dev build)
npm run ios          # Run on iOS
npm run web          # Run on Web
npm run lint         # Lint code
npm run lint:fix     # Auto-fix linting
npm run format       # Format code (src/** only)
npm run format:check # Check formatting (src/** only)
npm run type-check   # TypeScript type check
npm run prebuild     # Regenerate ios/ and android/ (destructive)
```

## Architecture

### State Management (Zustand)

- **`transactionStore`**: Manages transaction data and operations
- **`categoryStore`**: Manages category data
- **`budgetStore`**: Manages budget data
- **`appStore`**: Global app state (theme)

Stores are in-memory only; data is loaded from SQLite via `loadFromDb()` on app start and every mutation writes through to `dbService`.

### Database (SQLite)

Local persistence via `src/services/dbService.ts` (expo-sqlite). Three tables, one DB file `keuangan.db`:

- **`"Transaction"`**: id, amount, description, category, type (`income`/`expense`), date, notes
- **`Category`**: id, name, color, icon, type
- **`Budget`**: id, category, amount, period, startDate, endDate

Gotchas:

- `Transaction` is a SQLite reserved keyword — the table name is always quoted as `"Transaction"` in SQL. `Transaction` (interface) and `Transactions` (screen name) are unaffected.
- Default categories are seeded on first launch (`seedDefaultCategories`).
- Schema is created with `CREATE TABLE IF NOT EXISTS` — no migration framework yet.

### Gemini API Key

`src/services/keyService.ts` resolves the key at call time:

1. `expo-secure-store` (`gemini_api_key`, settable from **Settings** screen) — first
2. `process.env.EXPO_PUBLIC_GEMINI_API_KEY` — fallback
3. otherwise unconfigured → AI parsing errors with a "not configured" message

`parseTransactionWithAI()` in `src/services/geminiService.ts` does text-only parsing via Gemini REST API. No OCR, no voice, no 9router.

### Navigation

React Navigation, manually composed in `src/navigation/`:
- `RootNavigator` (native stack) → `BottomTabNavigator` (5 tabs)
- Typed param lists in `src/navigation/types.ts`

No `_layout.tsx`; expo-router is only used as the entry mechanism (`main: expo-router/entry`).

## Styling

React Native `StyleSheet` (no NativeWind/Tailwind). Design tokens:

- **Primary**: `#208AEF`
- **Success**: `#4caf50`
- **Error**: `#ff6b6b`
- **Background**: `#f5f5f5`

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Gemini AI (fallback only - the Settings screen can override per device)
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

Only `EXPO_PUBLIC_`-prefixed vars are inlined into the app bundle. Gemini keys always start with `AIza`.

## Code Style

Run before committing:

```bash
npm run lint
npm run type-check
npm run format:check
```

## Documentation

The `docs/` directory (PRD, IMPLEMENTATION-CHECKLIST, SETUP-SUMMARY, GEMINI-INTEGRATION-GUIDE) is maintained to match the current SQLite-based code. **This file remains the primary setup/architecture reference; trust code first.**

- [Expo SDK 54 Docs](https://docs.expo.dev/versions/v54.0.0/)
- [expo-sqlite](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/)
- [expo-secure-store](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/)
- [React Navigation](https://reactnavigation.org/)
- [Zustand](https://github.com/pmndrs/zustand)

## Phase 1 MVP Roadmap

- [x] Project initialization and setup
- [x] Folder structure and configuration
- [x] Core UI components
- [x] Navigation structure
- [x] SQLite models + CRUD service (`dbService.ts`)
- [x] State management (Zustand)
- [x] Dashboard screen
- [x] Transaction management (CRUD)
- [x] AI text parsing (Gemini)
- [x] Gemini key management (Settings)
- [ ] Complete Category management (CRUD)
- [ ] Complete Budget management
- [ ] Data sync and import/export
- [ ] Analytics and reporting
- [ ] Internationalization (i18n)
- [ ] Dark mode support

## Known Issues

- **Navigation warning**: "Passing an object as the argument to 'navigate' is deprecated" — emitted by a dependency internally, not from app code.
- **Gemini**: requires a valid key (`AIza...`); invalid keys surface as HTTP 400 `API_KEY_INVALID`.

---

**Version**: 1.0.0
**Last Updated**: 2026-08-05
