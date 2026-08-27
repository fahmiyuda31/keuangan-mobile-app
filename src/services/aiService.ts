import { AiMode, useModelStore } from '@/store/modelStore';
import {
  ChatMessage,
  chatWithFinancialAI as chatWithFinancialCloud,
  GeminiImage,
  isGeminiConfigured,
  ParsedTransaction,
  parseReceiptWithAI as parseReceiptCloud,
  parseTransactionWithAI as parseTransactionCloud,
} from './geminiService';
import {
  chatWithOnDeviceAI,
  checkModelExists,
  parseReceiptWithOnDeviceAI,
  parseTransactionWithOnDeviceAI,
  releaseOnDeviceModel,
} from './onDeviceAiService';

export interface AIStatus {
  available: boolean;
  mode: AiMode;
  modelDownloaded: boolean;
  cloudConfigured: boolean;
  activeBackend: 'on-device' | 'cloud' | 'none';
  backendLabel: string;
}

/**
 * Get comprehensive current status of AI services (On-Device + Cloud)
 */
export async function getAIStatus(): Promise<AIStatus> {
  const mode = useModelStore.getState().aiMode;
  const [modelDownloaded, cloudConfigured] = await Promise.all([
    checkModelExists(),
    isGeminiConfigured(),
  ]);

  let activeBackend: 'on-device' | 'cloud' | 'none' = 'none';
  let backendLabel = 'AI Tidak Tersedia';

  if (mode === 'on-device') {
    if (modelDownloaded) {
      activeBackend = 'on-device';
      backendLabel = 'On-Device Gemma (Offline)';
    } else {
      activeBackend = 'none';
      backendLabel = 'Model Belum Diunduh';
    }
  } else if (mode === 'cloud') {
    if (cloudConfigured) {
      activeBackend = 'cloud';
      backendLabel = 'Cloud Gemini API';
    } else {
      activeBackend = 'none';
      backendLabel = 'Gemini Belum Dikonfigurasi';
    }
  } else {
    // Auto (Hybrid)
    if (modelDownloaded) {
      activeBackend = 'on-device';
      backendLabel = 'Auto (On-Device Offline)';
    } else if (cloudConfigured) {
      activeBackend = 'cloud';
      backendLabel = 'Auto (Cloud Gemini Fallback)';
    } else {
      activeBackend = 'none';
      backendLabel = 'AI Belum Siap (Unduh model atau isi API Key)';
    }
  }

  const available = activeBackend !== 'none';

  return {
    available,
    mode,
    modelDownloaded,
    cloudConfigured,
    activeBackend,
    backendLabel,
  };
}

/**
 * Parse natural language transaction using Hybrid AI Router
 */
export async function parseTransactionWithAI(input: string): Promise<ParsedTransaction> {
  const status = await getAIStatus();

  if (status.mode === 'on-device') {
    if (!status.modelDownloaded) {
      throw new Error(
        'Mode On-Device aktif tetapi model belum diunduh. Silakan unduh model di Pengaturan.'
      );
    }
    return parseTransactionWithOnDeviceAI(input);
  }

  if (status.mode === 'cloud') {
    if (!status.cloudConfigured) {
      throw new Error('Mode Cloud aktif tetapi Gemini API Key belum dikonfigurasi.');
    }
    return parseTransactionCloud(input);
  }

  // Hybrid Auto Mode
  if (status.modelDownloaded) {
    try {
      return await parseTransactionWithOnDeviceAI(input);
    } catch (err) {
      console.warn('On-Device parse failed, falling back to Cloud Gemini:', err);
      if (status.cloudConfigured) {
        return await parseTransactionCloud(input);
      }
      throw err;
    }
  }

  if (status.cloudConfigured) {
    return parseTransactionCloud(input);
  }

  throw new Error(
    'Layanan AI belum siap. Unduh model On-Device di Pengaturan atau tambahkan Gemini API Key.'
  );
}

/**
 * Parse receipt image using Hybrid AI Router (best-effort on-device, cloud preferred for OCR)
 */
export async function parseReceiptWithAI(image: GeminiImage): Promise<ParsedTransaction> {
  const status = await getAIStatus();

  if (status.mode === 'on-device') {
    return parseReceiptWithOnDeviceAI(image);
  }

  // Cloud or Auto prefers Gemini Vision for high accuracy OCR
  if (status.cloudConfigured) {
    return parseReceiptCloud(image);
  }

  if (status.modelDownloaded) {
    return parseReceiptWithOnDeviceAI(image);
  }

  throw new Error('OCR Struk membutuhkan Gemini API Key (Cloud) atau Vision Model yang terpasang.');
}

/**
 * Chat with Financial AI using Hybrid AI Router with token streaming
 */
export async function chatWithFinancialAI(
  history: ChatMessage[],
  financialContext: string,
  onToken?: (token: string) => void
): Promise<string> {
  const status = await getAIStatus();

  if (status.mode === 'on-device') {
    if (!status.modelDownloaded) {
      throw new Error(
        'Model On-Device belum diunduh. Buka menu Pengaturan untuk mengunduh model Gemma 4 E2B.'
      );
    }
    return chatWithOnDeviceAI(history, financialContext, onToken);
  }

  if (status.mode === 'cloud') {
    if (!status.cloudConfigured) {
      throw new Error('Gemini API Key belum dikonfigurasi.');
    }
    return chatWithFinancialCloud(history, financialContext);
  }

  // Hybrid Auto Mode
  if (status.modelDownloaded) {
    try {
      return await chatWithOnDeviceAI(history, financialContext, onToken);
    } catch (err) {
      console.warn('On-Device chat failed, falling back to Cloud Gemini:', err);
      if (status.cloudConfigured) {
        return await chatWithFinancialCloud(history, financialContext);
      }
      throw err;
    }
  }

  if (status.cloudConfigured) {
    return chatWithFinancialCloud(history, financialContext);
  }

  throw new Error(
    'AI Chat belum dapat digunakan. Silakan unduh model Gemma offline di Pengaturan atau masukkan Gemini API Key.'
  );
}

/**
 * Release any active AI on-device session memory
 */
export async function releaseAISession(): Promise<void> {
  await releaseOnDeviceModel();
}

export type { ChatMessage, GeminiImage, ParsedTransaction };
