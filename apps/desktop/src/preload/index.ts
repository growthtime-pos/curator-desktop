import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import type { AppSettings } from '../renderer/src/types/settings';

const api = {
  settings: {
    save: async (settings: AppSettings): Promise<void> => {
      await ipcRenderer.invoke('settings:save', settings);
    },
    loadMasked: async () => ipcRenderer.invoke('settings:loadMasked') as Promise<AppSettings & { maskedApiKey: string }>,
  },
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI);
  contextBridge.exposeInMainWorld('electronAPI', api);
} else {
  // @ts-expect-error runtime fallback for disabled context isolation
  window.electron = electronAPI;
  // @ts-expect-error runtime fallback for disabled context isolation
  window.electronAPI = api;
}
