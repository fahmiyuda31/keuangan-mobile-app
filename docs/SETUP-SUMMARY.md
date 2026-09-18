# Keuangan Mobile App - Setup Summary

**Status**: SET UP — MVP working with local SQLite
**Date**: 2026-09-18
**Reference**: `README.md` is the source of truth. Older revisions of this doc (Realm-based) are obsolete.

---

## What is implemented

### 1. Project
- Expo SDK 54 (RN 0.81, React 19.1), TypeScript strict
- Entry: `app/index.tsx` via `expo-router/entry` (expo-router is only the entry; routing is manual React Navigation)

### 2. Database (SQLite, not Realm)
- `src/services/dbService.ts` — expo-sqlite, DB file `keuangan.db`
- Tables: `"Transaction"` (quoted — reserved keyword), `Category`, `Budget`
- Default categories auto-seeded on first launch
- Zustand stores hydrate from / write through to SQLite

### 3. State (Zustand)
- `transactionStore`, `categoryStore`, `budgetStore`, `appStore` (theme)
- In-memory state; persistence = SQLite via `dbService`

### 4. Navigation
- React Navigation: root native stack → bottom tabs (Dashboard, Transactions, Categories, Budgets, Settings)
- Typed param lists in `src/navigation/types.ts`

### 5. Screens
- Dashboard, Transactions, Categories, Budgets, AI Chat, Settings (in `src/screens/`)
- Settings includes Gemini API key management (save/clear)
- Dashboard and Transactions include date-based filtering and financial summaries

### 6. Services
- `dbService.ts` — SQLite CRUD (active)
- `geminiService.ts` — AI transaction parsing, receipt OCR, and financial assistant chat (Gemini)
- `keyService.ts` — Gemini key lookup (SecureStore → `.env` fallback)

### 7. Code quality
- ESLint flat config + Prettier + `npm run type-check`
- Verify before finishing: `lint` → `type-check` → `format:check`

---

## Getting started

```bash
npm install
cp .env.example .env        # optional; add EXPO_PUBLIC_GEMINI_API_KEY as fallback
npm run prebuild            # native modules need a dev build
npm run android             # or: npm run ios / npm start
```

## Gemini API key

Two sources, checked in this order at call time:

1. **Settings screen** (expo-secure-store, per device)
2. **`.env`** — `EXPO_PUBLIC_GEMINI_API_KEY` (fallback)

## Explicitly out of scope

Realtime/background cloud sync, voice input/voice memo, database encryption, and Google Sign-In.

## Verification

Run the repository checks before merging:

```bash
npm run lint
npm run type-check
npm run format:check
npm test
```

---

**Last Updated**: 2026-09-18
