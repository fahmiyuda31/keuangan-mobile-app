# Rencana Perbaikan berikutnya — antislop audit 001

Referensi: `anti-slop/audit-001-2026-09-16.md`. Status: **10, 11, 12, 13 (MEDIUM) sudah diperbaiki**. Berikut sisa temuan untuk sesi berikutnya, diurutkan prioritas.

---

## HIGH (Hard Gate) — prioritas utama

### 01 · R-02 Em dash di judul kartu — `src/screens/dashboard/DashboardScreen.tsx`
- Ganti `—` (em dash) di judul Card:
  - `:196` `incomeVsExpense — {period}` → `Perbandingan Pemasukan/Pengeluaran ({period})`
  - `:256` `totalExpense — {period}` → `Total Pengeluaran ({period})`
- Juga bersihkan en dash `–` di `src/screens/transactions/TransactionsScreen.tsx` (`formatWeek`, `filterLabel` → pakai `-` atau `sampai`).
- Cek ulang seluruh `src/` untuk karakter `—`/`–` setelahnya.

### 02 · R-25 Kontras `textMuted` gagal — `src/constants/theme.ts`
- Light `textMuted: '#98A0B3'` (2.7:1) → gelapkan ke `#5A6374` (≥4.5:1).
- Dark sudah lolos, jangan diubah.

### 03 · R-25 Hijau sebagai teks — `src/constants/theme.ts`
- Tambah token `successText` (atau ubah warna teks): untuk **teks**, pakai `#15803D` (light) / tetap hijau muda saat dibutuhkan di dark.
- `#22C55E` hanya untuk isian bar/dot. Perbarui pemakaian teks warna success di `TransactionsScreen`, `ImportTransactionsModal`, `DashboardScreen`.

### 04 · R-25 Merah sebagai teks — `src/constants/theme.ts`
- Token `dangerText` (atau sejenis): untuk **teks** pakai `#B91C1C` (light). Penerapan sama seperti item 03.
- `danger` `#EF4444` tetap untuk isian/aksi solid.

### 05 · R-25 Label hero Dashboard — `src/screens/dashboard/DashboardScreen.tsx`
- `heroLabel` (`rgba(255,255,255,0.75)`) dan `heroStatLabel` (`rgba(255,255,255,0.7)`) ≈ 2.1:1.
- Ganti ke putih solid atau `#EAF4FF`, atau gelapkan ujung gradasi `#5FB4FF` → `#3A86D6` agar kontras ≥4.5:1.

### 06 · R-27 State loading & error di layar data
- Dashboard, Transactions, Budgets, Categories menampilkan data SQLite async tanpa loading/error state.
- Solusi: satu pola bersama, mis. hook/`Skeleton` kecil:
  - Loading: `ActivityIndicator` saat store belum `loaded` (periksa store `loadFromDb` state / flag).
  - Error: view ringkas "Gagal memuat data" + tombol `Coba lagi` (panggil ulang `loadFromDb`).
- Rujukan pola yang sudah benar: `AIChatScreen` (empty + loading + Alert error).

### 07 · R-03 Tap target ≥ 44px
- Link teks "Edit"/"Hapus" (pb `rowActions`) dan tombol ikon 36px (`headerIconBtn`) di bawah minimum.
- Tambah `hitSlop={8}` atau padding 44px, terutama:
  - `src/screens/transactions/TransactionsScreen.tsx` (rowActions, headerIconBtn)
  - `src/screens/budgets/BudgetsScreen.tsx`, `src/screens/categories/CategoriesScreen.tsx` (rowActions)
  - `src/screens/settings/SettingsScreen.tsx`, `AIChatScreen` (clearBtn)
  - Semua chips kecil bukan masalah jika masih ≥44px area.

### 08 · R-03 `totalBar` rawan overflow — `src/screens/transactions/TransactionsScreen.tsx`
- 4 kolom sejajar nominal IDR panjang; uji di 320-360dp.
- Bila overflow: ubah jadi grid 2×2, atau `flexShrink:1` + angka tabular (`fontVariant: ['tabular-nums']`) + `numberOfLines={1}`.

### 09 · R-34 Warna hardcoded merusak dark mode
- `AddTransactionModal.tsx` & `AddCategoryModal.tsx`: `typeButtonActiveExpense` `#ffe0e0` / `Income` `#e0ffe0` / border `#44bb44` → token tema (danger/success tint per mode, teks tetap `colors.text`).
- `AIChatScreen.tsx`: badge `#e8f5e9`/`#e3f2fd`/`#fff3cd` + warning `#fff3cd` → token status per mode (light/dark).
- Verifikasi kedua mode (R-25 di dark juga).

---

## LOW (Quality Locks) — setelah HIGH bersih

### 14 · R-11 Skala radius konsisten
- Definisikan skala radius di `src/constants` dan patuhi: pill hanya untuk chip/FAB; input chat (`borderRadius:20` di AIChatScreen) → ikut skala input (8-12).

### 15 · R-16 Buzzword "seamlessly" — `src/i18n/index.ts` (EN `aiModeHint`)
- → "automatically falls back to cloud Gemini when needed."

### 16 · R-29 Satu palet data terkurasi
- Hindari 3 palet terpisah (`src/constants/index.ts` COLORS, `chartColors` Dashboard, `COLORS` AddCategoryModal).
- Satu sumber: palet kategori kurasi (selaras `theme.ts` + semantik in/out hijau/merah).

### 17 · R-20 Identitas visual
- Per `DESIGN.md`: angka uang selalu `fontVariant: ['tabular-nums']`; hijau/merah hanya untuk in/out.

### 18 · Dead code template Expo — hapus
- `src/components/app-tabs.tsx`, `web-badge.tsx`, `external-link.tsx`, `hint-row.tsx`, `animated-icon.tsx`, `animated-icon.web.tsx`, `themed-text.tsx`, `themed-view.tsx`, `src/components/ui/collapsible.tsx`.
- Pastikan benar tidak dirujuk (cek import) sebelum dihapus.

### 19 · En dash di label tanggal — `src/screens/transactions/TransactionsScreen.tsx`
- `formatWeek` / `filterLabel` `–` → `-` atau `sampai` (merapat ke item 01).

---

## Lingkungan (fix dulu agar lint/format normal)
- `npm i -D prettier` (sekarang `prettier` TIDAK ter-install; itulah kenapa `npm run lint` menggantung lewat `eslint-plugin-prettier`).
- Tambahkan script `format` / `format:check` di `package.json` (AGENTS.md menyebut keduanya tapi tidak ada di script; sinkronkan AGENTS.md).
- Verifikasi rutin: `npm run lint` → `npm run type-check`.
- Click-through native (R-35) perlu `npx expo run:android`; uji semua layar + kedua tema.

## Cara pakai dokumen ini
Sesi berikutnya: ambil nomor item yang ingin dikerjakan, kerjakan satu per satu, jalankan lint+type-check, lalu catat statusnya di bagian "Status" audit-001 (jangan hapus dokumen audit asli).