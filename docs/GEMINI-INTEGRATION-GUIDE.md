# AI Integration Guide (Hybrid: On-Device Gemma 4 E2B & Gemini Cloud)
## Keuangan Mobile App - Smart Financial Assistant & Parsing

**Version**: 3.0
**Date**: 2026-08-27
**Scope**: Natural-language transaction parsing, Receipt OCR, and Financial Assistant Chat with Hybrid Routing (Offline On-Device Gemma 4 E2B + Gemini Cloud Fallback).

---

## AI Architecture Overview

Fitur AI menggunakan layer **Hybrid Router (`src/services/aiService.ts`)** yang menyatukan:
1. **On-Device Offline AI (`src/services/onDeviceAiService.ts`)**: Menjalankan model quantized GGUF Gemma 4 E2B secara lokal menggunakan binding `llama.rn` (llama.cpp) dengan akselerasi OpenCL / GPU / CPU.
2. **Cloud AI Fallback (`src/services/geminiService.ts`)**: Memanggil Gemini API secara langsung via REST API (tanpa SDK eksternal) untuk OCR kualitas tinggi dan fallback bila model lokal belum diunduh.

```typescript
// Single entry point across UI screens
import {
  parseTransactionWithAI,
  parseReceiptWithAI,
  chatWithFinancialAI,
  getAIStatus,
} from '@/services/aiService';
```

---

## API key resolution

`src/services/keyService.ts` resolves the key **at call time**, in this order:

1. `expo-secure-store` — key `gemini_api_key`, set from the **Settings** screen
2. `process.env.EXPO_PUBLIC_GEMINI_API_KEY` — fallback from `.env`

`isGeminiConfigured()` is async and returns true if either source has a key.

### Set the key from the app

Settings screen → **AI / Gemini API Key**:

- **Save** → stores in `expo-secure-store` via `setGeminiKey()`
- **Clear** → deletes the stored key (`clearGeminiKey()`), falling back to `.env`

## Setup

1. Get a Gemini API key: https://aistudio.google.com/apikey (keys always start with `AIza`)
2. Either:
   - enter it in the app under **Settings**, or
   - add it to `.env` as a fallback:
     ```
     EXPO_PUBLIC_GEMINI_API_KEY=AIza...
     ```
3. Restart the dev server (`npm start`) after changing `.env` — `EXPO_PUBLIC_*` vars are inlined at bundle time. Fast refresh is not enough.

---

## How parsing works

- Prompt asks the model to return JSON only:
  `{"amount": <number>, "description": "<string>", "category": "<string>", "type": "<income|expense>"}`
- Rules baked into the prompt: amounts are positive IDR; `rb`/`ribu` = thousands, `jt`/`juta` = millions; type defaults to `expense` unless text suggests income (`gaji`, `salary`, `bonus`, ...).
- Response passes a JSON-extraction regex and is validated (amount number > 0, type in `income|expense`). Invalid output throws `AI returned an invalid transaction format.`

---

## Error handling

| Situation | Result |
|-----------|--------|
| No key in SecureStore or `.env` | `Gemini API key is not configured...` |
| Invalid key | HTTP 400 `API_KEY_INVALID` (logged as `Gemini API error: ...`) |
| Model returns non-JSON | `Could not parse AI response into a transaction.` |
| Model returns invalid shape | `AI returned an invalid transaction format.` |
| HTTP non-2xx | `Gemini API request failed: <status>` |

There is no automatic retry.

---

## Cost / limits

- Gemini free tier: 1,500 requests/day (subject to Google pricing at https://ai.google.dev). No billing config is wired into the app.

---

## Troubleshooting

- **`API key not valid` (HTTP 400)**: key wrong/expired/not an `AIza...` key. Fix in Settings or `.env`, then retry.
- **"Gemini Belum Dikonfigurasi"**: no key anywhere. Add one in Settings or `.env`.
- **Key still not picked up after `.env` change**: verify var name `EXPO_PUBLIC_GEMINI_API_KEY` and restart `npm start`.
- **SecureStore on web**: `expo-secure-store` does not support web; on web only the `.env` key works.

---

**Last Updated**: 2026-08-05
