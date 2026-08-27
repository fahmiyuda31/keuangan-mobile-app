# Product Requirements Document (PRD)
## Keuangan Mobile App

**Document Version:** 2.0
**Date Updated:** 2026-08-05
**Status:** Active — reflects current implementation
**Platform:** iOS & Android (Expo SDK 54, React Native)
**Reference:** `README-SETUP.md` for architecture; `IMPLEMENTATION-CHECKLIST.md` for status.

---

## Overview

Aplikasi finansial **standalone, offline-first** di iOS dan Android. Semua data tersimpan lokal di SQLite. Backup opsional ke Firebase Cloud (Firestore) dengan auth email/password. Tanpa server API milik sendiri.

### Key Points
- **Mobile only**: iOS & Android
- **Data lokal**: SQLite (`expo-sqlite`), file `keuangan.db` — bukan Realm, tanpa encryption (encryption di luar scope managed workflow)
- **AI Engine (Hybrid)**: On-Device Gemma 4 E2B (`llama.rn` offline engine) sebagai default lokal + Gemini API sebagai cloud fallback untuk OCR & analisis tambahan
- **Model Management**: Download, cancel, delete model GGUF (~1.6 GB) langsung dari menu Settings dengan deteksi jaringan seluler
- **Key management**: Gemini API key opsional untuk cloud fallback diisi via Settings (expo-secure-store) dengan fallback `.env`
- **Cloud backup**: Firebase (Firestore + Auth email/password, JS SDK v12) - backup/restore manual dari Settings
- **Login gate**: app dikunci balik login email/password (`src/screens/AuthScreen.tsx`) - hanya user terautentikasi yang bisa akses data; sesi persist via async-storage (offline tetap jalan setelah login pertama)
- **Offline-first**: bekerja 100% tanpa internet termasuk fitur AI Assistant & AI Parser saat model lokal telah diunduh
- **Export CSV/PDF & Local Backup**: diimplementasikan (expo-file-system + expo-print + expo-sharing)

---

## Product Scope & Features

### Implemented (MVP)

#### Dashboard
- Ringkasan saldo, income, expense
- Transaksi terbaru

#### Transaction Management
- Tambah transaksi manual (form: amount, description, type, category, date picker, notes)
- Tambah via AI text parsing (`parseTransactionWithAI`)
- Tambah via OCR foto struk (`parseReceiptWithAI`, kamera/gallery)
- List transaksi (urut by date desc), edit, delete (via UI)
- Filter helper di store: by category, by date range (sudah ada, belum dipakai UI)

#### Categories
- Default categories di-seed otomatis saat first launch (income: Gaji, Bonus, Investasi, Lainnya; expense: Makanan, Transportasi, Hiburan, Utilitas, Kesehatan, Pendidikan, Belanja, Lainnya)
- CRUD lengkap (list, tambah, edit, hapus)

#### Budgets
- Set budget per kategori (period: daily/weekly/monthly/yearly)
- CRUD lengkap (list, tambah, edit, hapus)

#### Dashboard
- Ringkasan saldo, income, expense
- Transaksi terbaru
- Chart pengeluaran per kategori (`react-native-chart-kit` PieChart)

#### Settings
- Preferensi aplikasi: tema (Light/Dark/System), bahasa (id/en)
- **Gemini API Key** (save / clear, disimpan di expo-secure-store)
- **Export Data**: CSV & PDF
- **Cloud Backup** (Firebase): status login, tombol Backup ke Cloud & Restore dari Cloud, Logout (login/register lewat screen AuthScreen)

#### Authentication (login gate)
- `src/screens/AuthScreen.tsx`: form email/password (Masuk/Daftar), tampil sebelum app kalau belum login
- Session persist via `@react-native-async-storage/async-storage` - setelah login sekali, buka app langsung masuk (offline aman)
- Kalau Firebase belum dikonfigurasi (`.env` kosong) atau platform web: gate di-skip (app langsung terbuka)

#### Navigation & UI
- Bottom tab: Dashboard  Transactions  Categories  Budgets  Settings
- `StyleSheet` (tanpa NativeWind), brand color primary `#208AEF`
- `SafeAreaView` dari `react-native-safe-area-context`
- Dark mode via palette `src/constants/theme.ts` + `useTheme()`
- i18n id/en via `src/i18n/`
- UI fintech-style (referensi FinEase): kartu radius 20 + shadow lembut, hero balance card gradient di Dashboard, chip pill, tombol FAB "+", tab bar rounded-top dengan pill aktif, tipografi judul layar 26/700

---

## Not Implemented (out of current scope)

- Auto-sync realtime / background sync (Firestore offline persistence web-only di RN JS SDK; backup bersifat manual)
- Google sign-in (butuh native `@react-native-google-signin` + prebuild)
- Voice input / voice memo (expo-av)
- Database encryption (expo-sqlite tak dukung SQLCipher di managed workflow)

---

## Data Model (SQLite)

### "Transaction" (quoted — reserved keyword)
`id` TEXT PK, `amount` REAL, `description` TEXT, `category` TEXT, `type` TEXT ('income'|'expense'), `date` TEXT, `notes` TEXT NULL, `createdAt` TEXT, `updatedAt` TEXT

### Category
`id` TEXT PK, `name` TEXT, `color` TEXT, `icon` TEXT, `type` TEXT, `createdAt` TEXT, `updatedAt` TEXT

### Budget
`id` TEXT PK, `category` TEXT, `amount` REAL, `period` TEXT, `startDate` TEXT, `endDate` TEXT NULL, `createdAt` TEXT, `updatedAt` TEXT

---

## Cloud Backup (Firebase)

- **Library**: `firebase` (JS SDK v12, tanpa native module) + `@react-native-async-storage/async-storage` untuk auth persistence (session bertahan antar buka app)
- **Auth**: email/password (Firebase Auth). Daftar/login/logout di Settings. Session persist via async-storage.
- **Data layout di Firestore** (per-record, hindari limit 1MB/doc): `users/{uid}/meta/backup` (timestamp + count) dan koleksi `users/{uid}/transactions/{id}`, `users/{uid}/categories/{id}`, `users/{uid}/budgets/{id}`
- **Backup**: batch-write chunk 450 record; tanggal disimpan sebagai ISO string (`src/utils/firebaseSync.ts` mapper)
- **Restore**: merge LWW by `updatedAt` - record cloud menang kalau `cloud.updatedAt >= local.updatedAt`; record local-only dipertahankan (tidak dihapus)
- **Security rules wajib**: `match /users/{uid}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == uid; }` dan deny-all untuk sisanya. Config Firebase bersifat publik - proteksi data lewat rules.
- **Config**: `EXPO_PUBLIC_FIREBASE_*` di `.env` (lihat `.env.example`). Register Web app di Firebase console (tidak perlu register app Android/iOS untuk JS SDK)
- **Persistence**: SQLite tetap source of truth; cloud hanya mirror. Firestore JS SDK di RN hanya memory cache (tanpa offline persistence durable) - bukan masalah untuk model backup manual.

---

## AI Integration

- Dua fungsi di `src/services/geminiService.ts`: `parseTransactionWithAI(input)` (teks) & `parseReceiptWithAI(image)` (OCR foto, inline base64)
- Key di-resolve saat panggil via `src/services/keyService.ts`: SecureStore (Settings) → `EXPO_PUBLIC_GEMINI_API_KEY` (`.env`)
- Gemini REST via `fetch`, tanpa SDK
- Key Gemini valid mulai `AIza`

Lihat `GEMINI-INTEGRATION-GUIDE.md` untuk detail.

---

## Non-Functional Requirements

- **Dev build wajib**: expo-sqlite, expo-secure-store, expo-camera, expo-image-picker native module → Expo Go tidak jalan (Firebase JS SDK tidak butuh dev build)
- **Startup**: init DB + migrasi + seed categories + load stores di `app/index.tsx` `useEffect`
- **Code quality**: `npm run lint`, `npm run type-check`, `npm run format:check` sebelum selesai; `npm test` (jest-expo, 5 suite)
---

**Last Updated**: 2026-08-05
