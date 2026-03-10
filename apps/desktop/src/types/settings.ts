export interface AppSettings {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  confluenceSpaceKey: string;
  syncIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: '',
  apiKey: '',
  model: 'gpt-4.1-mini',
  confluenceSpaceKey: '',
  syncIntervalMinutes: 30,
};

export interface StoredSettingsPayload {
  encrypted: string;
  iv: string;
  authTag: string;
}
