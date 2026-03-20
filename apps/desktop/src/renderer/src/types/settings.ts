export interface AppSettings {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  providerProtocol: 'chat' | 'responses';
  skillRootPaths: string[];
  confluenceSpaceKey: string;
  syncIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: '',
  apiKey: '',
  model: 'gpt-4.1-mini',
  providerProtocol: 'chat',
  skillRootPaths: [],
  confluenceSpaceKey: '',
  syncIntervalMinutes: 30,
};
