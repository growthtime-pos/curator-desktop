import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

type MessageRole = 'user' | 'assistant' | 'system';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

type ConnectionStatus = 'connected' | 'degraded' | 'offline';
type RateLimitStatus = 'idle' | 'waiting';

const initialMessages: Message[] = [
  { id: 'm1', role: 'system', content: 'Curator Assistant 준비 완료', timestamp: new Date() },
  { id: 'm2', role: 'assistant', content: '무엇을 도와드릴까요?', timestamp: new Date() },
];

const mockConversationList = [
  { name: 'General', icon: '○' },
  { name: 'Confluence Sync', icon: '◇' },
  { name: 'Release Note Draft', icon: '△' },
];

const formatSyncTime = (lastSyncedAt: Date | null) => {
  if (!lastSyncedAt) return '동기화 이력 없음';
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(lastSyncedAt);
};

const formatMessageTime = (date: Date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const buildResponse = (userInput: string) =>
  `"${userInput}" 요청을 분석해 Confluence 문서와 최근 대화 맥락을 반영한 초안을 생성했습니다.`;

/* ─── Role config ─── */
const roleConfig: Record<MessageRole, { label: string; color: string; prefix: string }> = {
  user: { label: 'you', color: 'var(--blue)', prefix: '❯' },
  assistant: { label: 'curator', color: 'var(--accent)', prefix: '◆' },
  system: { label: 'system', color: 'var(--text-muted)', prefix: '●' },
};

/* ─── Status Badge ─── */
const StatusBadge = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
      padding: '3px 10px',
      background: 'var(--bg-input)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-sm)',
    }}
  >
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}40`,
      }}
    />
    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span>{value}</span>
  </span>
);

/* ─── Message Bubble ─── */
const MessageBubble = ({
  message,
  isStreaming,
}: {
  message: Message | { role: MessageRole; content: string; timestamp?: Date };
  isStreaming?: boolean;
}) => {
  const config = roleConfig[message.role];
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const bubbleStyle: CSSProperties = {
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    background: isUser
      ? 'var(--bg-user-msg)'
      : isSystem
        ? 'var(--bg-system-msg)'
        : 'var(--bg-assistant-msg)',
    border: `1px solid ${isUser ? '#3d3b70' : isSystem ? 'rgba(99,102,241,0.15)' : 'rgba(218,119,86,0.12)'}`,
    marginBottom: 4,
  };

  return (
    <div style={{ marginBottom: 16, maxWidth: '85%', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ color: config.color }}>{config.prefix}</span>
        <span style={{ color: config.color, fontWeight: 600 }}>{config.label}</span>
        {'timestamp' in message && message.timestamp && (
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
            {formatMessageTime(message.timestamp)}
          </span>
        )}
        {isStreaming && (
          <span
            style={{
              color: 'var(--accent)',
              fontSize: 10,
              marginLeft: 4,
              animation: 'pulse 1.5s infinite',
            }}
          >
            ● streaming
          </span>
        )}
      </div>
      <div style={bubbleStyle}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.7,
            color: isSystem ? 'var(--text-secondary)' : 'var(--text-primary)',
            fontFamily: isSystem ? 'var(--font-mono)' : 'var(--font-sans)',
            fontStyle: isSystem ? 'italic' : 'normal',
          }}
        >
          {message.content}
          {isStreaming && (
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 16,
                background: 'var(--accent)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                animation: 'blink 1s step-end infinite',
              }}
            />
          )}
        </p>
      </div>
    </div>
  );
};

/* ─── Main Chat Page ─── */
export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prompt, setPrompt] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [connectionStatus] = useState<ConnectionStatus>('connected');
  const [lastSyncedAt] = useState<Date | null>(new Date());
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>('idle');
  const [activeConversation, setActiveConversation] = useState('General');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(
    () => prompt.trim().length > 0 && !streamingMessage,
    [prompt, streamingMessage],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const appendStreamingResponse = async (sourceText: string) => {
    setRateLimitStatus('waiting');
    setStreamingMessage('');

    for (const chunk of sourceText.split(' ')) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      setStreamingMessage((prev) => `${prev}${chunk} `);
    }

    setMessages((prev) => [
      ...prev,
      { id: `m${prev.length + 1}`, role: 'assistant', content: sourceText, timestamp: new Date() },
    ]);
    setStreamingMessage('');
    setRateLimitStatus('idle');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;

    const userInput = prompt.trim();
    setMessages((prev) => [
      ...prev,
      { id: `m${prev.length + 1}`, role: 'user', content: userInput, timestamp: new Date() },
    ]);
    setPrompt('');
    await appendStreamingResponse(buildResponse(userInput));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const statusColor = {
    connected: 'var(--green)',
    degraded: 'var(--yellow)',
    offline: 'var(--red)',
  };

  return (
    <>
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <main
        style={{
          display: 'flex',
          height: 'calc(100vh - 44px)',
          background: 'var(--bg-primary)',
        }}
      >
        {/* ─── Sidebar ─── */}
        <aside
          style={{
            width: 240,
            borderRight: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '16px 14px 12px',
              borderBottom: '1px solid var(--border-primary)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 12,
              }}
            >
              conversations
            </div>

            {mockConversationList.map((conv) => {
              const isActive = conv.name === activeConversation;
              return (
                <button
                  key={conv.name}
                  onClick={() => setActiveConversation(conv.name)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 2,
                    textAlign: 'left',
                    padding: '8px 10px',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--accent-dim)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <span style={{ opacity: 0.6 }}>{conv.icon}</span>
                  {conv.name}
                </button>
              );
            })}
          </div>

          {/* Sidebar footer */}
          <div style={{ marginTop: 'auto', padding: 14, borderTop: '1px solid var(--border-primary)' }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: statusColor[connectionStatus],
                    boxShadow: `0 0 4px ${statusColor[connectionStatus]}60`,
                  }}
                />
                backend: {connectionStatus}
              </div>
              <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                sync: {formatSyncTime(lastSyncedAt)}
              </div>
            </div>
          </div>
        </aside>

        {/* ─── Chat Area ─── */}
        <section style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          {/* Header */}
          <header
            style={{
              padding: '8px 20px',
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-secondary)',
              minHeight: 40,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text-accent)',
                fontWeight: 600,
              }}
            >
              ~/curator
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              {activeConversation}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <StatusBadge
                label="backend"
                value={connectionStatus}
                color={statusColor[connectionStatus]}
              />
              <StatusBadge
                label="rate"
                value={rateLimitStatus === 'waiting' ? '대기 중' : '정상'}
                color={rateLimitStatus === 'waiting' ? 'var(--yellow)' : 'var(--green)'}
              />
            </div>
          </header>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {streamingMessage && (
              <MessageBubble
                message={{ role: 'assistant', content: streamingMessage, timestamp: new Date() }}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
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
                transition: 'border-color 0.15s ease',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: 'var(--accent)',
                  fontWeight: 700,
                  lineHeight: '22px',
                  flexShrink: 0,
                }}
              >
                ❯
              </span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="메시지를 입력하세요..."
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
                  maxHeight: 120,
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
                  padding: '6px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: canSend ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                전송
              </button>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              <span>Enter로 전송 · Shift+Enter로 줄바꿈</span>
              <span>
                {prompt.length > 0 && `${prompt.length} chars`}
              </span>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}
