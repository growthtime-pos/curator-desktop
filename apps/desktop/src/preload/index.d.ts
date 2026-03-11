import type { ElectronAPI } from '@electron-toolkit/preload';
import type { AppSettings } from '../renderer/src/types/settings';

declare global {
  interface Window {
    electron: ElectronAPI;
    electronAPI: {
      settings: {
        save: (settings: AppSettings) => Promise<void>;
        loadMasked: () => Promise<AppSettings & { maskedApiKey: string }>;
      };
    };
  }
}

export {};
