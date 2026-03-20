import { FormEvent, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createChatBackend } from '../services/chatBackend';
import type { ChatBackend } from '../services/chatBackend';
import type { ChatMessage, ChatSession, SkillRecommendation, SkillSummary } from '../types/chat';
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
  padding: '4px 10px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '999px',
};

const chipStyle: CSSProperties = {
  border: '1px solid var(--border-primary)',
  borderRadius: '999px',
  padding: '5px 10px',
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
};

const roleLabel: Record<ChatMessage['role'], string> = {
  system: 'system',
  user: 'you',
  assistant: 'assistant',
  tool: 'tool',
};

const roleColor: Record<ChatMessage['role'], string> = {
  system: 'var(--text-muted)',
  user: 'var(--blue)',
  assistant: 'var(--accent)',
  tool: 'var(--green)',
};

export function ChatPage() {
  const [backend, setBackend] = useState<ChatBackend | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [allSkills, setAllSkills] = useState<SkillSummary[]>([]);
  const [recommendations, setRecommendations] = useState<SkillRecommendation[]>([]);
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, recommendations]);

  useEffect(() => {
    if (!backend || !session || !prompt.trim()) return;

    const handle = window.setTimeout(async () => {
      try {
        const next = await backend.recommendSkills(prompt, session.activeSkillIds, settings);
        setRecommendations(next);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load skill recommendations.');
      }
    }, 240);

    return () => window.clearTimeout(handle);
  }, [backend, prompt, session, settings]);

  const activeSkills = allSkills.filter((skill) => session?.activeSkillIds.includes(skill.id));

  const initialize = async () => {
    setBooting(true);
    setError(null);
    try {
      const loadedSettings = await loadSettings();
      const nextBackend = await createChatBackend();
      const [createdSession, skills] = await Promise.all([
        nextBackend.createSession(loadedSettings),
        nextBackend.listSkills(loadedSettings),
      ]);

      setSettings(loadedSettings);
      setBackend(nextBackend);
      setSession(createdSession);
      setAllSkills(skills);
      setRecommendations(createdSession.pendingSkillSuggestions);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to initialize chat.');
    } finally {
      setBooting(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!backend || !session || !prompt.trim() || sending) return;

    setSending(true);
    setError(null);
    try {
      const nextSession = await backend.sendMessage(session.sessionId, prompt.trim(), settings);
      setSession(nextSession);
      setRecommendations(nextSession.pendingSkillSuggestions);
      setPrompt('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleActivateSkill = async (skillId: string) => {
    if (!backend || !session) return;
    const nextSession = await backend.activateSkill(session.sessionId, skillId);
    setSession(nextSession);
    setRecommendations(nextSession.pendingSkillSuggestions);
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (!backend || !session) return;
    const nextSession = await backend.removeSkill(session.sessionId, skillId);
    setSession(nextSession);
  };

  const statusLabel = backend?.source === 'remote' ? 'fastapi' : backend?.source === 'mock' ? 'mock' : 'booting';
  const canSend = Boolean(prompt.trim()) && !sending && !booting;

  return (
    <main
      style={{
        display: 'flex',
        height: 'calc(100vh - 44px)',
        background: 'var(--bg-primary)',
      }}
    >
      <aside
        style={{
          width: 300,
          borderRight: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-primary)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                session
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                {session?.sessionId ?? 'loading'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void initialize()}
              style={{
                ...chipStyle,
                cursor: 'pointer',
              }}
            >
              New Session
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={badgeStyle}>backend: {statusLabel}</span>
            <span style={badgeStyle}>protocol: {settings.providerProtocol}</span>
            <span style={badgeStyle}>skills: {allSkills.length}</span>
          </div>
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-primary)' }}>
          <div
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
            }}
          >
            active skills
          </div>
          {activeSkills.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>
              Activate a recommended skill to scope the next answer.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeSkills.map((skill) => (
                <div
                  key={skill.id}
                  style={{
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    background: 'var(--bg-input)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                    <strong style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{skill.name}</strong>
                    <button
                      type="button"
                      onClick={() => void handleRemoveSkill(skill.id)}
                      style={{ ...chipStyle, cursor: 'pointer', color: 'var(--red)' }}
                    >
                      Remove
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {skill.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '16px', overflowY: 'auto' }}>
          <div
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
            }}
          >
            recommended skills
          </div>
          {recommendations.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>
              Type a prompt mentioning release notes, Confluence, workspace files, or a skill name.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recommendations.map((recommendation) => (
                <button
                  key={recommendation.skill.id}
                  type="button"
                  onClick={() => void handleActivateSkill(recommendation.skill.id)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    background: 'var(--bg-input)',
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <strong style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      {recommendation.skill.name}
                    </strong>
                    <span style={{ ...chipStyle, padding: '3px 8px' }}>{recommendation.score.toFixed(1)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {recommendation.skill.description}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    {recommendation.reason}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <header
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>
              OpenAI-compatible chat
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
              Skills are recommended automatically and applied only after explicit activation.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={badgeStyle}>model: {settings.model || 'unset'}</span>
            <span style={badgeStyle}>
              active: {activeSkills.map((skill) => skill.name).join(', ') || 'none'}
            </span>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
          {booting && (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              Starting chat session...
            </div>
          )}

          {session?.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {!booting && session?.messages.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              No messages yet.
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: '1px solid var(--border-primary)',
            padding: '14px 20px',
            background: 'var(--bg-secondary)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                color: 'var(--accent)',
                fontWeight: 700,
                lineHeight: '22px',
              }}
            >
              {'>'}
            </span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit(event as unknown as FormEvent);
                }
              }}
              rows={2}
              placeholder="Ask for release notes, Confluence help, or use Workspace Toolkit to inspect the repo."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--text-primary)',
                lineHeight: '22px',
                maxHeight: 160,
              }}
            />
            <button
              type="submit"
              disabled={!canSend}
              style={{
                background: canSend ? 'var(--accent)' : 'var(--bg-hover)',
                color: canSend ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 600,
                cursor: canSend ? 'pointer' : 'default',
              }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 8,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            <span>Press Enter to send. Shift+Enter inserts a newline.</span>
            <span>{error ?? `${prompt.length} chars`}</span>
          </div>
        </form>
      </section>
    </main>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const background = isUser
    ? 'var(--bg-user-msg)'
    : isTool
      ? 'rgba(74, 222, 128, 0.08)'
      : message.role === 'system'
        ? 'var(--bg-system-msg)'
        : 'var(--bg-assistant-msg)';

  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: roleColor[message.role],
        }}
      >
        <span>{roleLabel[message.role]}</span>
        <span style={{ color: 'var(--text-muted)' }}>{formatTime(message.createdAt)}</span>
      </div>
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          background,
          border: '1px solid var(--border-primary)',
        }}
      >
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7 }}>{message.content}</p>

        {message.appliedSkillNames.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {message.appliedSkillNames.map((skillName) => (
              <span key={skillName} style={chipStyle}>
                skill: {skillName}
              </span>
            ))}
          </div>
        )}

        {message.trace.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {message.trace.map((line) => (
              <span key={line} style={{ ...chipStyle, display: 'inline-flex', width: 'fit-content' }}>
                {line}
              </span>
            ))}
          </div>
        )}

        {message.warnings.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {message.warnings.map((line) => (
              <span key={line} style={{ fontSize: 11, color: 'var(--yellow)', fontFamily: 'var(--font-mono)' }}>
                warning: {line}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const loaded = await window.electronAPI?.settings?.loadMasked?.();
    if (!loaded) return DEFAULT_SETTINGS;
    const { maskedApiKey: _maskedApiKey, ...settings } = loaded;
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
