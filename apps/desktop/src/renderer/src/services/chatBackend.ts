import type { AppSettings } from '../types/settings';
import type {
  ChatMessage,
  ChatSession,
  ProviderConfigSnapshot,
  SkillRecommendation,
  SkillSummary,
} from '../types/chat';

const BACKEND_BASE_URL = 'http://127.0.0.1:8000';
const HEALTH_TIMEOUT_MS = 800;

const MOCK_SKILLS: SkillSummary[] = [
  {
    id: 'release-note-draft',
    name: 'Release Note Draft',
    description: 'Use when the user asks for release notes, changelogs, or concise shipping summaries.',
    rootPath: '.codex/skills/release-note-draft',
    sourcePath: '.codex/skills/release-note-draft/SKILL.md',
    referenceFiles: [],
    toolDefinitions: [],
    loadErrors: [],
  },
  {
    id: 'confluence-summarizer',
    name: 'Confluence Summarizer',
    description: 'Use when the user asks about Confluence pages, synced docs, or knowledge-base summaries.',
    rootPath: '.codex/skills/confluence-summarizer',
    sourcePath: '.codex/skills/confluence-summarizer/SKILL.md',
    referenceFiles: [],
    toolDefinitions: [],
    loadErrors: [],
  },
  {
    id: 'workspace-toolkit',
    name: 'Workspace Toolkit',
    description: 'Use when the user needs a workspace overview, file listing, or repository inventory.',
    rootPath: '.codex/skills/workspace-toolkit',
    sourcePath: '.codex/skills/workspace-toolkit/SKILL.md',
    referenceFiles: [],
    toolDefinitions: [
      {
        name: 'list_workspace_overview',
        description: 'Return a compact view of top-level folders in the current workspace.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      },
    ],
    loadErrors: [],
  },
];

export type ChatBackend = {
  source: 'remote' | 'mock';
  createSession: (settings: AppSettings) => Promise<ChatSession>;
  getSession: (sessionId: string) => Promise<ChatSession>;
  listSkills: (settings: AppSettings) => Promise<SkillSummary[]>;
  recommendSkills: (
    message: string,
    activeSkillIds: string[],
    settings: AppSettings,
  ) => Promise<SkillRecommendation[]>;
  activateSkill: (sessionId: string, skillId: string) => Promise<ChatSession>;
  removeSkill: (sessionId: string, skillId: string) => Promise<ChatSession>;
  sendMessage: (sessionId: string, content: string, settings: AppSettings) => Promise<ChatSession>;
};

export async function createChatBackend(): Promise<ChatBackend> {
  if (await isBackendHealthy()) {
    return createRemoteBackend();
  }
  return createMockBackend();
}

async function isBackendHealthy(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function createRemoteBackend(): ChatBackend {
  return {
    source: 'remote',
    createSession: async (settings) =>
      requestJson<ChatSession>('/chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ providerConfig: toProviderConfig(settings) }),
      }),
    getSession: async (sessionId) => requestJson<ChatSession>(`/chat/sessions/${sessionId}`),
    listSkills: async (settings) => {
      const params = new URLSearchParams();
      settings.skillRootPaths.forEach((value) => params.append('skillRootPaths', value));
      const query = params.toString();
      return requestJson<SkillSummary[]>(`/skills${query ? `?${query}` : ''}`);
    },
    recommendSkills: async (message, activeSkillIds, settings) =>
      requestJson<SkillRecommendation[]>('/skills/recommend', {
        method: 'POST',
        body: JSON.stringify({
          message,
          activeSkillIds,
          providerConfig: toProviderConfig(settings),
        }),
      }),
    activateSkill: async (sessionId, skillId) =>
      requestJson<ChatSession>(`/chat/sessions/${sessionId}/skills`, {
        method: 'POST',
        body: JSON.stringify({ skillId }),
      }),
    removeSkill: async (sessionId, skillId) =>
      requestJson<ChatSession>(`/chat/sessions/${sessionId}/skills/${skillId}`, {
        method: 'DELETE',
      }),
    sendMessage: async (sessionId, content, settings) =>
      requestJson<ChatSession>(`/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content,
          providerConfig: toProviderConfig(settings),
        }),
      }),
  };
}

function createMockBackend(): ChatBackend {
  const sessions = new Map<string, ChatSession>();

  const createSessionRecord = (settings: AppSettings): ChatSession => {
    const now = new Date().toISOString();
    const session: ChatSession = {
      sessionId: `mock_${Math.random().toString(36).slice(2)}`,
      messages: [
        createMessage('system', 'Curator Desktop mock backend is active.'),
        createMessage('assistant', 'Ask for release notes, Confluence help, or a workspace overview.'),
      ],
      activeSkillIds: [],
      pendingSkillSuggestions: [],
      providerConfigSnapshot: toProviderConfig(settings),
      createdAt: now,
      updatedAt: now,
    };
    sessions.set(session.sessionId, session);
    return session;
  };

  return {
    source: 'mock',
    createSession: async (settings) => createSessionRecord(settings),
    getSession: async (sessionId) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error('Mock session not found.');
      return clone(session);
    },
    listSkills: async () => clone(MOCK_SKILLS),
    recommendSkills: async (message, activeSkillIds) => recommendMockSkills(message, activeSkillIds),
    activateSkill: async (sessionId, skillId) => {
      const session = requireSession(sessions, sessionId);
      if (!session.activeSkillIds.includes(skillId)) {
        session.activeSkillIds = [...session.activeSkillIds, skillId];
      }
      session.pendingSkillSuggestions = session.pendingSkillSuggestions.filter((item) => item.skill.id !== skillId);
      session.updatedAt = new Date().toISOString();
      return clone(session);
    },
    removeSkill: async (sessionId, skillId) => {
      const session = requireSession(sessions, sessionId);
      session.activeSkillIds = session.activeSkillIds.filter((current) => current !== skillId);
      session.updatedAt = new Date().toISOString();
      return clone(session);
    },
    sendMessage: async (sessionId, content, settings) => {
      const session = requireSession(sessions, sessionId);
      session.providerConfigSnapshot = toProviderConfig(settings);

      const userMessage = createMessage('user', content);
      const recommendations = recommendMockSkills(content, session.activeSkillIds);
      session.messages = [...session.messages, userMessage];
      session.pendingSkillSuggestions = recommendations;

      const activeSkills = MOCK_SKILLS.filter((skill) => session.activeSkillIds.includes(skill.id));
      const trace: string[] = [];
      const extraMessages: ChatMessage[] = [];
      let assistantBody = `Mock response for "${content}".`;

      const usesWorkspaceTool =
        session.activeSkillIds.includes('workspace-toolkit') &&
        /\b(file|files|folder|workspace|repo|repository|structure)\b/i.test(content);

      if (usesWorkspaceTool) {
        trace.push('Tool executed: list_workspace_overview');
        extraMessages.push(
          createMessage('tool', 'apps/\ndocs/\npackages/\n.codex/', {
            toolName: 'list_workspace_overview',
            toolCallId: 'mock_tool_call_1',
          }),
        );
        assistantBody += '\n\nWorkspace Toolkit inspected the repository root and found the main top-level directories.';
      } else if (activeSkills.length > 0) {
        assistantBody += `\n\nApplied skills: ${activeSkills.map((skill) => skill.name).join(', ')}.`;
      } else {
        assistantBody += '\n\nNo active skills yet. Use one of the suggested skills to scope the answer.';
      }

      const assistantMessage = createMessage('assistant', assistantBody, {
        appliedSkillIds: activeSkills.map((skill) => skill.id),
        appliedSkillNames: activeSkills.map((skill) => skill.name),
        trace,
        warnings: ['Using the local mock backend because the FastAPI server is unavailable.'],
      });

      session.messages = [...session.messages, ...extraMessages, assistantMessage];
      session.updatedAt = new Date().toISOString();
      sessions.set(sessionId, session);
      return clone(session);
    },
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function toProviderConfig(settings: AppSettings): ProviderConfigSnapshot {
  return {
    apiBaseUrl: settings.apiBaseUrl.trim(),
    apiKey: settings.apiKey,
    model: settings.model.trim() || 'gpt-4.1-mini',
    providerProtocol: settings.providerProtocol,
    skillRootPaths: settings.skillRootPaths,
  };
}

function recommendMockSkills(message: string, activeSkillIds: string[]): SkillRecommendation[] {
  const lowered = message.toLowerCase();
  const recommendations = MOCK_SKILLS.filter((skill) => !activeSkillIds.includes(skill.id))
    .map((skill) => {
      let score = 0;
      let reason = 'Keyword match in skill metadata';
      let explicit = false;

      if (lowered.includes(skill.name.toLowerCase()) || lowered.includes(`$${skill.id}`)) {
        score += 10;
        explicit = true;
        reason = 'Explicit skill mention';
      }

      const keywords = `${skill.name} ${skill.description}`.toLowerCase().split(/\W+/);
      keywords.forEach((keyword) => {
        if (keyword.length > 2 && lowered.includes(keyword)) {
          score += 1;
        }
      });
      return { skill, score, reason, explicit };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  return clone(recommendations);
}

function requireSession(sessions: Map<string, ChatSession>, sessionId: string): ChatSession {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }
  return session;
}

function createMessage(
  role: ChatMessage['role'],
  content: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: `msg_${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    appliedSkillIds: [],
    appliedSkillNames: [],
    trace: [],
    warnings: [],
    toolName: null,
    toolCallId: null,
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
