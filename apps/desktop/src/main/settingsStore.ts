import fs from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import type { AppSettings } from '../renderer/src/types/settings';
import { DEFAULT_SETTINGS } from '../renderer/src/types/settings';

const SETTINGS_FILE_NAME = 'settings.secure.json';

interface StoredSettingsPayload {
  encrypted: string;
  encryption: 'safeStorage';
}

const getStorePath = () => path.join(app.getPath('userData'), SETTINGS_FILE_NAME);

const serialize = (settings: AppSettings) => JSON.stringify(settings);

const deserialize = (value: string): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...(JSON.parse(value) as Partial<AppSettings>),
});

const encryptSettings = (settings: AppSettings): StoredSettingsPayload => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level encryption is not available in this environment.');
  }

  const encrypted = safeStorage.encryptString(serialize(settings));
  return {
    encryption: 'safeStorage',
    encrypted: encrypted.toString('base64'),
  };
};

const decryptSettings = (payload: StoredSettingsPayload): AppSettings => {
  const encryptedBuffer = Buffer.from(payload.encrypted, 'base64');
  const decrypted = safeStorage.decryptString(encryptedBuffer);
  return deserialize(decrypted);
};

const maskApiKey = (apiKey: string) => {
  if (!apiKey) return '';
  if (apiKey.length <= 4) return '*'.repeat(apiKey.length);
  return `${apiKey.slice(0, 2)}${'*'.repeat(apiKey.length - 4)}${apiKey.slice(-2)}`;
};

export const settingsStore = {
  async save(settings: AppSettings) {
    const payload = encryptSettings(settings);
    const storePath = getStorePath();

    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(payload, null, 2), 'utf8');
  },

  async load(): Promise<AppSettings> {
    try {
      const raw = await fs.readFile(getStorePath(), 'utf8');
      const payload = JSON.parse(raw) as StoredSettingsPayload;
      return decryptSettings(payload);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  async loadMasked(): Promise<AppSettings & { maskedApiKey: string }> {
    const settings = await this.load();
    return {
      ...settings,
      apiKey: '',
      maskedApiKey: maskApiKey(settings.apiKey),
    };
  },
};
