import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { AppSettings, StoredSettingsPayload } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const SETTINGS_FILE_NAME = 'settings.secure.json';
const KEY_SALT = 'curator-desktop.settings.v1';

const getStorePath = () => path.join(app.getPath('userData'), SETTINGS_FILE_NAME);

const deriveEncryptionKey = () => {
  const machineFingerprint = [
    process.env.USER ?? 'unknown-user',
    process.env.HOSTNAME ?? 'unknown-host',
    app.getName(),
    app.getVersion(),
  ].join(':');

  return crypto.scryptSync(machineFingerprint, KEY_SALT, 32);
};

const encryptSettings = (settings: AppSettings): StoredSettingsPayload => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveEncryptionKey(), iv);
  const plaintext = JSON.stringify(settings);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
};

const decryptSettings = (payload: StoredSettingsPayload): AppSettings => {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveEncryptionKey(),
    Buffer.from(payload.iv, 'base64'),
  );

  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encrypted, 'base64')),
    decipher.final(),
  ]);

  return {
    ...DEFAULT_SETTINGS,
    ...(JSON.parse(decrypted.toString('utf8')) as Partial<AppSettings>),
  };
};

const maskApiKey = (apiKey: string) => {
  if (!apiKey) {
    return '';
  }

  if (apiKey.length <= 4) {
    return '*'.repeat(apiKey.length);
  }

  const visiblePrefix = apiKey.slice(0, 2);
  const visibleSuffix = apiKey.slice(-2);
  return `${visiblePrefix}${'*'.repeat(apiKey.length - 4)}${visibleSuffix}`;
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
