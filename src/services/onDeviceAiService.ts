import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { LlamaContext } from 'llama.rn';
import { ParsedTransaction, GeminiImage, ChatMessage } from './geminiService';

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

const MODEL_DIR = `${FileSystem.documentDirectory || ''}models/`;
const DEFAULT_MODEL_FILENAME =
  process.env.EXPO_PUBLIC_HF_MODEL_FILENAME || 'gemma-2-2b-it-Q4_K_M.gguf';
const DEFAULT_MODEL_URL =
  process.env.EXPO_PUBLIC_HF_MODEL_URL ||
  'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf';

let llamaContextInstance: LlamaContext | null = null;
let currentDownloadResumable: FileSystem.DownloadResumable | null = null;

/**
 * Get full path to local model GGUF file
 */
export async function getOnDeviceModelPath(): Promise<string> {
  return `${MODEL_DIR}${DEFAULT_MODEL_FILENAME}`;
}

/**
 * Check if the on-device GGUF model exists locally
 */
export async function checkModelExists(): Promise<boolean> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return false;
  try {
    const modelPath = await getOnDeviceModelPath();
    const info = await FileSystem.getInfoAsync(modelPath);
    return !!(info.exists && info.size && info.size > 1024 * 1024); // > 1MB check
  } catch (err) {
    console.warn('Error checking model existence:', err);
    return false;
  }
}

/**
 * Get formatted file size of the downloaded model
 */
export async function getOnDeviceModelSize(): Promise<string | null> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return null;
  try {
    const modelPath = await getOnDeviceModelPath();
    const info = await FileSystem.getInfoAsync(modelPath);
    if (!info.exists || !info.size) return null;
    const sizeMB = info.size / (1024 * 1024);
    if (sizeMB >= 1024) {
      return `${(sizeMB / 1024).toFixed(2)} GB`;
    }
    return `${sizeMB.toFixed(1)} MB`;
  } catch {
    return null;
  }
}

/**
 * Download on-device Gemma model from Hugging Face with progress tracking
 */
export async function downloadOnDeviceModel(
  onProgress?: (progressRatio: number, bytesWritten: number, totalBytes: number) => void
): Promise<string> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    throw new Error('On-device AI model is not supported on Web.');
  }

  // Ensure directory exists
  const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }

  const modelPath = await getOnDeviceModelPath();

  currentDownloadResumable = FileSystem.createDownloadResumable(
    DEFAULT_MODEL_URL,
    modelPath,
    {},
    (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesExpectedToWrite > 0
          ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
          : 0;
      if (onProgress) {
        onProgress(
          progress,
          downloadProgress.totalBytesWritten,
          downloadProgress.totalBytesExpectedToWrite
        );
      }
    }
  );

  const result = await currentDownloadResumable.downloadAsync();
  currentDownloadResumable = null;

  if (!result || !result.uri) {
    throw new Error('Download failed: file not written.');
  }

  return result.uri;
}

/**
 * Cancel ongoing model download
 */
export async function cancelModelDownload(): Promise<void> {
  if (currentDownloadResumable) {
    await currentDownloadResumable.cancelAsync();
    currentDownloadResumable = null;
    throw new Error('DOWNLOAD_CANCELLED');
  }
}

/**
 * Delete local model files from storage
 */
export async function deleteOnDeviceModel(): Promise<void> {
  await releaseOnDeviceModel();
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return;
  const modelPath = await getOnDeviceModelPath();
  const info = await FileSystem.getInfoAsync(modelPath);
  if (info.exists) {
    await FileSystem.deleteAsync(modelPath, { idempotent: true });
  }
}

/**
 * Detect hardware acceleration info (GPU / CPU)
 */
export async function getHardwareBackendInfo(): Promise<string> {
  if (Platform.OS === 'web') return 'Web (N/A)';
  try {
    const { getBackendDevicesInfo } = require('llama.rn');
    if (typeof getBackendDevicesInfo === 'function') {
      const devices = await getBackendDevicesInfo();
      if (devices && devices.length > 0) {
        const gpuDevice = devices.find((d: any) => d.type === 'gpu' || d.type === 'opencl');
        if (gpuDevice) {
          return `GPU (${gpuDevice.name || 'OpenCL'})`;
        }
      }
    }
    return Platform.OS === 'android' ? 'OpenCL / CPU' : 'Metal / CPU';
  } catch {
    return 'CPU';
  }
}

/**
 * Initialize or get cached llama.rn context
 */
export async function initOnDeviceModel(): Promise<LlamaContext> {
  if (llamaContextInstance) {
    return llamaContextInstance;
  }

  const exists = await checkModelExists();
  if (!exists) {
    throw new Error(
      'Model AI On-Device belum diunduh. Silakan unduh model di menu Pengaturan terlebih dahulu.'
    );
  }

  const modelPath = await getOnDeviceModelPath();
  const cleanPath = modelPath.replace(/^file:\/\//, '');

  let initLlama: any;
  try {
    const llamaModule = require('llama.rn');
    initLlama = llamaModule?.initLlama;
    if (typeof initLlama !== 'function') {
      throw new Error('initLlama function is not exported by llama.rn');
    }
  } catch (err: any) {
    throw new Error(
      `Modul native llama.rn belum terpasang di binary APK saat ini (${err.message || err}). Silakan rebuild aplikasi menggunakan: npx expo run:android`
    );
  }

  // 1. Try GPU acceleration (OpenCL on Android, Metal on iOS)
  try {
    const ctx = await initLlama({
      model: cleanPath,
      n_ctx: 2048,
      n_gpu_layers: Platform.OS === 'android' ? 99 : 99,
      use_mlock: false,
      use_mmap: true,
      n_threads: 4,
    });
    llamaContextInstance = ctx;
    return ctx;
  } catch (gpuError: any) {
    console.warn('GPU model initialization failed, attempting fallback to CPU:', gpuError);
  }

  // 2. Fallback to CPU inference
  try {
    const ctx = await initLlama({
      model: cleanPath,
      n_ctx: 1024,
      n_gpu_layers: 0,
      use_mlock: false,
      use_mmap: true,
      n_threads: 4,
    });
    llamaContextInstance = ctx;
    return ctx;
  } catch (cpuError: any) {
    console.error('CPU model initialization failed:', cpuError);
    throw new Error(
      `Inisialisasi engine on-device gagal (${cpuError.message || cpuError}). Pastikan memori RAM cukup untuk model 2B.`
    );
  }
}

/**
 * Release on-device llama session memory
 */
export async function releaseOnDeviceModel(): Promise<void> {
  if (llamaContextInstance) {
    try {
      await llamaContextInstance.release();
    } catch (err) {
      console.warn('Error releasing Llama context:', err);
    } finally {
      llamaContextInstance = null;
    }
  }
}

/**
 * Helper to build Gemma instruction prompt
 */
function buildGemmaPrompt(system: string, user: string): string {
  return `<start_of_turn>user\n${system}\n\n${user}<end_of_turn>\n<start_of_turn>model\n`;
}

/**
 * Parse natural language transaction using on-device Gemma model
 */
export async function parseTransactionWithOnDeviceAI(input: string): Promise<ParsedTransaction> {
  const context = await initOnDeviceModel();

  const systemPrompt = `You are an Indonesian personal finance transaction parser.
Extract the transaction into structured JSON.
Available categories: ${DEFAULT_CATEGORIES.join(', ')}

Rules:
- "amount": positive number in IDR (e.g. "25rb" -> 25000, "1.5jt" -> 1500000).
- "description": brief summary.
- "category": closest match from the available categories.
- "type": "expense" or "income".

Respond ONLY with valid JSON object:
{"amount": <number>, "description": "<string>", "category": "<string>", "type": "<income|expense>"}`;

  const prompt = buildGemmaPrompt(systemPrompt, `Input: "${input}"`);

  const response = await context.completion({
    prompt,
    n_predict: 256,
    temperature: 0.1,
    stop: ['<end_of_turn>', '<start_of_turn>', '\n\n\n'],
  });

  const textContent = response.text || '';
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemma On-Device: Tidak dapat memformat respons transaksi.');
  }

  const parsed: ParsedTransaction = JSON.parse(jsonMatch[0]);

  if (
    typeof parsed.amount !== 'number' ||
    parsed.amount <= 0 ||
    !parsed.description ||
    !parsed.category ||
    !['income', 'expense'].includes(parsed.type)
  ) {
    throw new Error('Gemma On-Device: Format data transaksi tidak valid.');
  }

  return parsed;
}

/**
 * Parse receipt using on-device vision or multimodal projector
 */
export async function parseReceiptWithOnDeviceAI(_image: GeminiImage): Promise<ParsedTransaction> {
  const context = await initOnDeviceModel();

  const isMultimodal =
    typeof context.isMultimodalEnabled === 'function' ? await context.isMultimodalEnabled() : false;

  if (!isMultimodal) {
    throw new Error(
      'Vision multimodal belum aktif di on-device model. Gunakan mode Cloud untuk OCR struk.'
    );
  }

  const prompt = `Read this Indonesian receipt image and extract total amount, store name, category, and type (expense).
Respond ONLY with JSON: {"amount": <number>, "description": "<string>", "category": "<string>", "type": "expense"}`;

  const response = await context.completion({
    prompt,
    n_predict: 256,
    temperature: 0.1,
  });

  const textContent = response.text || '';
  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemma On-Device: Gagal membaca struk foto.');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Chat with Financial AI on-device with streaming support
 */
export async function chatWithOnDeviceAI(
  history: ChatMessage[],
  financialContext: string,
  onToken?: (token: string) => void
): Promise<string> {
  const context = await initOnDeviceModel();

  const systemInstruction = `Anda adalah Asisten Keuangan Pribadi (Financial AI Advisor) berbahasa Indonesia yang ramah, bijak, dan membantu.
Tugas Anda adalah menganalisis kondisi keuangan pengguna secara offline dan menjawab pertanyaan seputar keuangan berdasarkan data transaksi lokal berikut:

DATA KEUANGAN PENGGUNA SAAT INI:
${financialContext}

Petunjuk:
- Berikan analisis ringkas & saran berhemat yang konstruktif berbasis data di atas.
- Gunakan Bahasa Indonesia yang santun dan format bullet points yang rapi.`;

  let prompt = `<start_of_turn>user\n${systemInstruction}<end_of_turn>\n`;
  prompt += `<start_of_turn>model\nHalo! Saya asisten keuangan offline Anda. Saya siap menganalisis data keuangan lokal Anda secara privat.<end_of_turn>\n`;

  for (const msg of history) {
    if (msg.role === 'user') {
      prompt += `<start_of_turn>user\n${msg.content}<end_of_turn>\n`;
    } else {
      prompt += `<start_of_turn>model\n${msg.content}<end_of_turn>\n`;
    }
  }
  prompt += `<start_of_turn>model\n`;

  let accumulatedText = '';

  const response = await context.completion(
    {
      prompt,
      n_predict: 512,
      temperature: 0.7,
      stop: ['<end_of_turn>', '<start_of_turn>'],
    },
    (tokenData) => {
      const token = tokenData.token;
      accumulatedText += token;
      if (onToken) {
        onToken(accumulatedText);
      }
    }
  );

  return response.text || accumulatedText || 'Tidak ada tanggapan dari model on-device.';
}
