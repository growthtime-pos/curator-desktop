import { FormEvent, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-secondary)',
};

const inputStyle: CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 12px',
  fontSize: 13,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'border-color 0.15s ease',
  width: '100%',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 14,
  marginTop: 24,
  paddingBottom: 8,
  borderBottom: '1px solid var(--border-subtle)',
};

export function SettingsPage() {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await window.electronAPI?.settings?.save?.(form);
    setSavedAt(new Date().toLocaleString('ko-KR'));
    setSaving(false);
  };

  return (
    <main
      style={{
        height: 'calc(100vh - 44px)',
        overflowY: 'auto',
        background: 'var(--bg-primary)',
        padding: '32px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                color: 'var(--accent)',
                fontWeight: 700,
              }}
            >
              ◆
            </span>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
              }}
            >
              설정
            </h1>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            Curator Desktop 연결 및 동기화 설정을 관리합니다.
          </p>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column' }}>
          {/* API Section */}
          <div style={sectionTitleStyle}>api configuration</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>$</span> API Base URL
              </span>
              <input
                value={form.apiBaseUrl}
                onChange={(e) => updateField('apiBaseUrl', e.target.value)}
                placeholder="https://api.internal.example"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>$</span> API Key
              </span>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => updateField('apiKey', e.target.value)}
                placeholder="sk-..."
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>$</span> Model
              </span>
              <input
                value={form.model}
                onChange={(e) => updateField('model', e.target.value)}
                placeholder="gpt-4.1-mini"
                style={inputStyle}
              />
            </label>
          </div>

          {/* Confluence Section */}
          <div style={sectionTitleStyle}>confluence</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>$</span> Space Key
              </span>
              <input
                value={form.confluenceSpaceKey}
                onChange={(e) => updateField('confluenceSpaceKey', e.target.value)}
                placeholder="ENG"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              <span>
                <span style={{ color: 'var(--text-muted)' }}>$</span> 동기화 주기 (분)
              </span>
              <input
                type="number"
                min={1}
                value={form.syncIntervalMinutes}
                onChange={(e) => updateField('syncIntervalMinutes', Number(e.target.value) || 1)}
                style={inputStyle}
              />
            </label>
          </div>

          {/* Save */}
          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 24px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '저장 중...' : '설정 저장'}
            </button>
            {savedAt && (
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--green)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                ✓ 마지막 저장: {savedAt}
              </span>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
