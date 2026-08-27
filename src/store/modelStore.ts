import {
    cancelModelDownload,
    checkModelExists,
    deleteOnDeviceModel,
    downloadOnDeviceModel,
    getHardwareBackendInfo,
    getOnDeviceModelPath,
    getOnDeviceModelSize,
    initOnDeviceModel,
    releaseOnDeviceModel,
} from '@/services/onDeviceAiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type AiMode = 'on-device' | 'cloud' | 'auto';
export type ModelStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';

const AI_MODE_STORAGE_KEY = 'ai_operating_mode';

export interface ModelStoreState {
  status: ModelStatus;
  downloadProgress: number; // 0 to 100
  downloadBytesWritten: number;
  downloadTotalBytes: number;
  modelPath: string | null;
  visionPath: string | null;
  modelSize: string | null;
  aiMode: AiMode;
  backendInfo: string;
  errorMessage: string | null;

  // Actions
  initStore: () => Promise<void>;
  setAiMode: (mode: AiMode) => Promise<void>;
  checkModelStatus: () => Promise<boolean>;
  startDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  deleteModel: () => Promise<void>;
  loadModel: () => Promise<void>;
  unloadModel: () => Promise<void>;
}

export const useModelStore = create<ModelStoreState>((set, get) => ({
  status: 'idle',
  downloadProgress: 0,
  downloadBytesWritten: 0,
  downloadTotalBytes: 0,
  modelPath: null,
  visionPath: null,
  modelSize: null,
  aiMode: 'auto',
  backendInfo: 'CPU',
  errorMessage: null,

  initStore: async () => {
    try {
      const savedMode = await AsyncStorage.getItem(AI_MODE_STORAGE_KEY);
      if (savedMode && ['on-device', 'cloud', 'auto'].includes(savedMode)) {
        set({ aiMode: savedMode as AiMode });
      }

      const backend = await getHardwareBackendInfo();
      set({ backendInfo: backend });

      await get().checkModelStatus();
    } catch (err: any) {
      console.warn('Failed to initialize modelStore:', err);
    }
  },

  setAiMode: async (mode: AiMode) => {
    set({ aiMode: mode });
    try {
      await AsyncStorage.setItem(AI_MODE_STORAGE_KEY, mode);
    } catch (err) {
      console.warn('Failed to persist AI mode:', err);
    }
  },

  checkModelStatus: async () => {
    set({ status: 'checking', errorMessage: null });
    try {
      const exists = await checkModelExists();
      if (exists) {
        const path = await getOnDeviceModelPath();
        const size = await getOnDeviceModelSize();
        set({
          status: 'ready',
          modelPath: path,
          modelSize: size,
          errorMessage: null,
        });
        return true;
      } else {
        set({
          status: 'idle',
          modelPath: null,
          modelSize: null,
          errorMessage: null,
        });
        return false;
      }
    } catch (err: any) {
      set({
        status: 'error',
        errorMessage: err.message || 'Failed to check model status',
      });
      return false;
    }
  },

  startDownload: async () => {
    const currentStatus = get().status;
    if (currentStatus === 'downloading') return;

    set({
      status: 'downloading',
      downloadProgress: 0,
      downloadBytesWritten: 0,
      downloadTotalBytes: 0,
      errorMessage: null,
    });

    try {
      await downloadOnDeviceModel((progress, written, total) => {
        set({
          downloadProgress: Math.min(100, Math.round(progress * 100)),
          downloadBytesWritten: written,
          downloadTotalBytes: total,
        });
      });

      const path = await getOnDeviceModelPath();
      const size = await getOnDeviceModelSize();

      set({
        status: 'ready',
        downloadProgress: 100,
        modelPath: path,
        modelSize: size,
        errorMessage: null,
      });
    } catch (err: any) {
      if (err.message === 'DOWNLOAD_CANCELLED') {
        set({ status: 'idle', downloadProgress: 0, errorMessage: null });
      } else {
        set({
          status: 'error',
          errorMessage: err.message || 'Download model failed',
        });
      }
    }
  },

  cancelDownload: async () => {
    try {
      await cancelModelDownload();
      set({
        status: 'idle',
        downloadProgress: 0,
        downloadBytesWritten: 0,
        downloadTotalBytes: 0,
      });
    } catch (err: any) {
      console.warn('Failed to cancel download:', err);
    }
  },

  deleteModel: async () => {
    try {
      await releaseOnDeviceModel();
      await deleteOnDeviceModel();
      set({
        status: 'idle',
        modelPath: null,
        modelSize: null,
        downloadProgress: 0,
        errorMessage: null,
      });
    } catch (err: any) {
      set({
        errorMessage: err.message || 'Failed to delete model',
      });
    }
  },

  loadModel: async () => {
    try {
      await initOnDeviceModel();
    } catch (err: any) {
      set({
        errorMessage: err.message || 'Failed to load on-device model',
      });
      throw err;
    }
  },

  unloadModel: async () => {
    try {
      await releaseOnDeviceModel();
    } catch (err: any) {
      console.warn('Failed to unload model:', err);
    }
  },
}));

