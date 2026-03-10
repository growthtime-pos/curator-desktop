import { FormEvent, useMemo, useState } from 'react';

type MessageRole = 'user' | 'assistant' | 'system';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

type ConnectionStatus = 'connected' | 'degraded' | 'offline';

type RateLimitStatus = 'idle' | 'waiting';

const statusColorMap: Record<ConnectionStatus | RateLimitStatus, string> = {
  connected: '#16a34a',
  degraded: '#ca8a04',
  offline: '#dc2626',
  idle: '#2563eb',
  waiting: '#ea580c',
};

const initialMessages: Message[] = [
  { id: 'm1', role: 'system', content: 'Curator Assistant 준비 완료' },
  { id: 'm2', role: 'assistant', content: '무엇을 도와드릴까요?' },
];

const mockConversationList = ['General', 'Confluence Sync', 'Release Note Draft'];

const formatSyncTime = (lastSyncedAt: Date | null) => {
  if (!lastSyncedAt) {
    return '동기화 이력 없음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(lastSyncedAt);
};

const StatusBadge = ({ label, value, tone }: { label: string; value: string; tone: ConnectionStatus | RateLimitStatus }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 999,
      padding: '4px 10px',
      fontSize: 12,
      color: '#0f172a',
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: statusColorMap[tone],
      }}
    />
    {label}: {value}
  </span>
);

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [prompt, setPrompt] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [connectionStatus] = useState<ConnectionStatus>('connected');
  const [lastSyncedAt] = useState<Date | null>(new Date());
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>('idle');

  const canSend = useMemo(() => prompt.trim().length > 0 && !streamingMessage, [prompt, streamingMessage]);

  const appendStreamingResponse = async (sourceText: string) => {
    setRateLimitStatus('waiting');
    setStreamingMessage('');

    for (const chunk of sourceText.split(' ')) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      setStreamingMessage((prev) => `${prev}${chunk} `);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `m${prev.length + 1}`,
        role: 'assistant',
        content: sourceText,
      },
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
      {
        id: `m${prev.length + 1}`,
        role: 'user',
        content: userInput,
      },
    ]);

    setPrompt('');
    await appendStreamingResponse(`"${userInput}" 요청을 분석해 Confluence 문서와 최근 대화 맥락을 반영한 초안을 생성했습니다.`);
  };

  return (
    <main style={{ display: 'flex', height: '100vh', backgroundColor: '#f1f5f9' }}>
      <aside style={{ width: 260, borderRight: '1px solid #cbd5e1', padding: 16, background: '#ffffff' }}>
        <h2 style={{ marginTop: 0 }}>대화 목록</h2>
        {mockConversationList.map((conversation) => (
          <button key={conversation} style={{ width: '100%', marginBottom: 8, textAlign: 'left', padding: 10 }}>
            {conversation}
          </button>
        ))}
      </aside>

      <section style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <header style={{ padding: 16, borderBottom: '1px solid #cbd5e1', display: 'flex', gap: 8, flexWrap: 'wrap', background: '#fff' }}>
          <StatusBadge label="백엔드" value={connectionStatus} tone={connectionStatus} />
          <StatusBadge label="마지막 동기화" value={formatSyncTime(lastSyncedAt)} tone={connectionStatus} />
          <StatusBadge label="Rate Limit" value={rateLimitStatus === 'waiting' ? '대기 중' : '정상'} tone={rateLimitStatus} />
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {messages.map((message) => (
            <article key={message.id} style={{ marginBottom: 12 }}>
              <strong>{message.role}</strong>
              <p style={{ margin: '4px 0 0' }}>{message.content}</p>
            </article>
          ))}
          {streamingMessage && (
            <article style={{ marginBottom: 12 }}>
              <strong>assistant (streaming)</strong>
              <p style={{ margin: '4px 0 0' }}>{streamingMessage}</p>
            </article>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ borderTop: '1px solid #cbd5e1', padding: 16, background: '#fff' }}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            placeholder="메시지를 입력하세요"
            style={{ width: '100%', marginBottom: 8, padding: 10 }}
          />
          <button type="submit" disabled={!canSend} style={{ padding: '8px 16px' }}>
            전송
          </button>
        </form>
      </section>
    </main>
  );
}
