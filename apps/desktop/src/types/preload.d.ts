import type { AppSettings } from './settings';

declare global {
  interface Window {
    electronAPI?: {
      settings?: {
        save?: (settings: AppSettings) => Promise<void>;
      };
    };
  }
}

export {};
