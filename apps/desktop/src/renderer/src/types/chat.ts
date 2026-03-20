export interface ProviderConfigSnapshot {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  providerProtocol: 'chat' | 'responses';
  skillRootPaths: string[];
}

export interface SkillToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: boolean | Record<string, unknown>;
  };
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  rootPath: string;
  sourcePath: string;
  referenceFiles: string[];
  toolDefinitions: SkillToolDefinition[];
  loadErrors: string[];
}

export interface SkillRecommendation {
  skill: SkillSummary;
  score: number;
  reason: string;
  explicit: boolean;
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  appliedSkillIds: string[];
  appliedSkillNames: string[];
  trace: string[];
  warnings: string[];
  toolName?: string | null;
  toolCallId?: string | null;
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  activeSkillIds: string[];
  pendingSkillSuggestions: SkillRecommendation[];
  providerConfigSnapshot: ProviderConfigSnapshot;
  createdAt: string;
  updatedAt: string;
}
