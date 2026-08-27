import { getGeminiKey, getGeminiModel } from './keyService';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface ParsedTransaction {
  amount: number;
  description: string;
  category: string;
  type: 'income' | 'expense';
}

const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Entertainment',
  'Utilities',
  'Health',
  'Education',
  'Shopping',
  'Salary',
  'Other',
];

export interface GeminiImage {
  mimeType: string;
  base64: string;
}

function buildPrompt(input: string): string {
  return `You are a financial transaction parser for an Indonesian personal finance app.
Parse the following text into a structured transaction.

Available categories: ${DEFAULT_CATEGORIES.join(', ')}

Rules:
- "amount" must be a positive number in IDR (Indonesian Rupiah).
- Common abbreviations: "rb" or "ribu" = thousands, "jt" or "juta" = millions.
- "type" is "expense" by default, unless the text clearly indicates income (e.g., "gaji", "salary", "terima", "dapat", "bonus").
- "category" must be one of the available categories listed above. Pick the closest match.
- "description" should be a concise summary of the transaction.

Text: "${input}"

Respond ONLY with a valid JSON object (no markdown, no explanation):
{"amount": <number>, "description": "<string>", "category": "<string>", "type": "<income|expense>"}`;
}

function buildReceiptPrompt(): string {
  return `You are a financial transaction parser for an Indonesian personal finance app.
Read the receipt image and extract the transaction.

Available categories: ${DEFAULT_CATEGORIES.join(', ')}

Rules:
- "amount" must be a positive number in IDR (Indonesian Rupiah). Use the total amount if present.
- "type" is "expense" (receipts are expenses).
- "category" must be one of the available categories listed above. Pick the closest match.
- "description" should be a concise summary of the store or items.

Respond ONLY with a valid JSON object (no markdown, no explanation):
{"amount": <number>, "description": "<string>", "category": "<string>", "type": "<income|expense>"}`;
}

async function callGemini(prompt: string, image?: GeminiImage): Promise<ParsedTransaction> {
  const [apiKey, model] = await Promise.all([getGeminiKey(), getGeminiModel()]);
  if (!apiKey) {
    throw new Error(
      'Gemini API key is not configured. Add one in Settings or via EXPO_PUBLIC_GEMINI_API_KEY in your .env file.'
    );
  }

  const parts: any[] = [];
  if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
  }
  parts.push({ text: prompt });

  const response = await fetch(
    `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Gemini API error:', errorBody);
    throw new Error(`Gemini API request failed: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse AI response into a transaction.');
  }

  const parsed: ParsedTransaction = JSON.parse(jsonMatch[0]);

  if (
    typeof parsed.amount !== 'number' ||
    parsed.amount <= 0 ||
    !parsed.description ||
    !parsed.category ||
    !['income', 'expense'].includes(parsed.type)
  ) {
    throw new Error('AI returned an invalid transaction format.');
  }

  return parsed;
}

/**
 * Parse a natural language text input into a structured transaction
 * using Google Gemini API (direct HTTP fetch).
 */
export async function parseTransactionWithAI(input: string): Promise<ParsedTransaction> {
  return callGemini(buildPrompt(input));
}

/**
 * Parse a receipt image into a structured transaction using Gemini vision.
 */
export async function parseReceiptWithAI(image: GeminiImage): Promise<ParsedTransaction> {
  return callGemini(buildReceiptPrompt(), image);
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

/**
 * Chat with Gemini AI about financial status given transaction context and chat history.
 */
export async function chatWithFinancialAI(
  history: ChatMessage[],
  financialContext: string
): Promise<string> {
  const [apiKey, model] = await Promise.all([getGeminiKey(), getGeminiModel()]);
  if (!apiKey) {
    throw new Error(
      'Gemini API key is not configured. Add one in Settings or via EXPO_PUBLIC_GEMINI_API_KEY in your .env file.'
    );
  }

  const systemInstruction = `Anda adalah Asisten Keuangan Pribadi (Financial AI Advisor) berbahasa Indonesia yang ramah, bijak, dan membantu.
Tugas Anda adalah menganalisis kondisi keuangan pengguna dan menjawab pertanyaan seputar keuangan berdasarkan data transaksi SQLite yang disediakan.

DATA KEUANGAN PENGGUNA SAAT INI:
${financialContext}

Petunjuk:
- Berikan analisis atau saran yang relevan, konstruktif, dan berbasis data di atas.
- Jika pengguna bertanya tentang statistik (misal: pengeluaran terbesar, total saldo, dll), gunakan data yang tersedia di atas.
- Gunakan bahasa Indonesia yang santun, mudah dipahami, dan menggunakan format yang rapi (gunakan bullet points atau penekanan jika diperlukan).`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: systemInstruction }],
    },
    {
      role: 'model',
      parts: [
        {
          text: 'Halo! Saya siap membantu Anda menganalisis kondisi keuangan dan memberikan saran terbaik berdasarkan data transaksi Anda. Ada yang ingin Anda tanyakan?',
        },
      ],
    },
    ...history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
  ];

  const response = await fetch(
    `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Gemini Chat API error:', errorBody);
    throw new Error(`Gemini API request failed: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!textContent) {
    throw new Error('Tidak ada respon dari AI.');
  }

  return textContent;
}

/**
 * Check if the Gemini API key is configured
 */
export async function isGeminiConfigured(): Promise<boolean> {
  return !!(await getGeminiKey());
}
