# Implementation Checklist
## Keuangan Mobile App - Current State

**Project**: Keuangan Mobile App
**Architecture**: Expo SDK 54 + React Native 0.81 + TypeScript, offline-first, SQLite
**Date**: 2026-09-18
**Reference**: `README-SETUP.md` is the source of truth. This checklist reflects what is actually implemented.

---

## Implemented

### Foundation
- [x] Expo SDK 54 project (`expo ~54.0.0`, RN 0.81, React 19.1)
- [x] TypeScript strict + path aliases (`@/*` -> `src/*`)
- [x] ESLint flat config (`eslint.config.js`, typescript-eslint + prettier), Prettier, `type-check`
- [x] Navigation: manual React Navigation — root stack + 5-tab bottom navigator
- [x] SafeAreaView via `react-native-safe-area-context` (RN core version deprecated)

### Database (expo-sqlite) — `src/services/dbService.ts`
- [x] DB file `keuangan.db`, opened with `openDatabaseSync`
- [x] Versioned migration framework via `PRAGMA user_version` (`migrateDatabase`) — v1 = current schema
- [x] Tables created with `CREATE TABLE IF NOT EXISTS`: `"Transaction"`, `Category`, `Budget`
  - `Transaction` is a SQLite reserved keyword → table name always quoted as `"Transaction"`.
- [x] Full CRUD for all three entities (add / get all / update / delete)
- [x] Default category seeding on first launch (`seedDefaultCategories`)
- [x] Stores (Zustand) hydrate from DB via `loadFromDb()` and write through on every mutation

### AI Parsing — `src/services/geminiService.ts`
- [x] Text transaction parsing via `parseTransactionWithAI(input)`
- [x] Receipt OCR via Gemini vision `parseReceiptWithAI(image)` (inline base64 image)
- [x] Financial assistant chat via `chatWithFinancialAI(history, financialContext)` using SQLite transaction context
- [x] Gemini via direct `fetch` (no SDK)
- [x] Key resolution via `src/services/keyService.ts`: `expo-secure-store` (set from Settings) → `EXPO_PUBLIC_GEMINI_API_KEY` fallback
- [x] Settings screen: save / clear the Gemini API key

### Screens
- [x] Dashboard (filter periode Harian/Mingguan/Bulanan/Tahunan, date picker, summary + expense-by-category PieChart per periode, trend BarChart income vs expense, recent transactions)
- [x] Transactions (list sorted by date desc, manual/AI/OCR entry, edit, delete, notes, day/week/month/custom-range filters, bulk selection/delete, income/expense totals, remaining balance, savings percentage)
- [x] Categories — full CRUD
- [x] Budgets — full CRUD
- [x] AI Chat — financial assistant with chat history, quick prompts, markdown response rendering, and SQLite-backed context
- [x] Settings (Gemini API key, theme toggle, language toggle, export CSV/PDF, import bulk file catatan/Samsung Notes — txt/md & sdocx via `src/utils/sdocx.ts`)

### UI / i18n / Theme
- [x] i18n id/en (`src/i18n/`) — semua string UI via `useT()`/`t()`
- [x] Dark mode — theme palette (`src/constants/theme.ts`) + `useTheme()`, toggle Light/Dark/System
- [x] Export CSV + PDF (`src/services/exportService.ts`, expo-file-system + expo-print + expo-sharing)
- [x] OCR foto: expo-camera + expo-image-picker di AddTransactionModal
- [x] Cloud Backup (Firebase): `src/services/firebaseService.ts` (JS SDK v12, auth email/password via async-storage, backup/restore ke koleksi `users/{uid}/{transactions,categories,budgets}`, merge LWW by `updatedAt`; serialization/merge di `src/utils/firebaseSync.ts`), Settings kartu "Cloud Backup"
- [x] Login gate: `src/screens/AuthScreen.tsx` (email/password) tampil sebelum app di `app/index.tsx`; sesi persist async-storage; di-skip kalau Firebase belum dikonfigurasi / web

### Build / Tooling
- [x] `npm run prebuild` (`expo prebuild --clean`) — required because expo-sqlite/expo-secure-store are native modules; Expo Go will NOT work
- [x] Scripts: `start`, `android`, `ios`, `web`, `lint`, `lint:fix`, `format`, `format:check`, `type-check`, `test`
- [x] Tests via jest-expo (5 suites: `aggregate`, `i18n`, `import`, `sdocx`, `firebaseSync`)

---

## Not implemented (planned / out of scope)

- Auto-sync realtime / background sync (Firebase manual backup/restore saja; Firestore offline persistence web-only, RN JS SDK memory cache)
- Voice input / voice memo (no expo-av)
- Database encryption (expo-sqlite tak dukung SQLCipher di managed workflow)
- Google sign-in (butuh native `@react-native-google-signin`, prebuild ulang)

---

**Last Updated**: 2026-09-18
