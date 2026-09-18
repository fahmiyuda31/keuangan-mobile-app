# Gemini AI Integration Guide
## Keuangan Mobile App - AI Transaction Parsing

**Version**: 2.0
**Date**: 2026-09-18
**Scope**: Transaction parsing, receipt OCR, and financial assistant chat. Voice input is NOT implemented.

---

## What the code actually does

`src/services/geminiService.ts` exports:

```typescript
parseTransactionWithAI(input: string): Promise<ParsedTransaction>
parseReceiptWithAI(image: GeminiImage): Promise<ParsedTransaction>
chatWithFinancialAI(history: ChatMessage[], financialContext: string): Promise<string>
isGeminiConfigured(): Promise<boolean>
```

`parseTransactionWithAI` parses free text (e.g. `"beli makan siang 25rb"`) into a structured transaction:

```typescript
interface ParsedTransaction {
  amount: number;                 // positive number, IDR
  description: string;
  category: string;               // from DEFAULT_CATEGORIES
  type: 'income' | 'expense';
}
```

Gemini is called with plain `fetch` to `generativelanguage.googleapis.com` — no SDK (`@google/generative-ai` is NOT installed). There is no audio input, no `retryWithBackoff`, and no `validateApiKey`.

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

## How transaction parsing works

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

## Financial assistant chat

The AI Chat tab builds a financial context from the current SQLite transactions and sends it
together with the current session history to `chatWithFinancialAI`. The assistant is instructed
to answer in Indonesian using the supplied data, including totals and spending insights. Chat
history is held in screen state and is not persisted to SQLite or Firebase.

The chat UI also provides quick prompts and renders common markdown formatting in responses.

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

**Last Updated**: 2026-09-18
