import { FormEvent, useEffect, useState } from 'react';
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

const hintStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  lineHeight: 1.5,
};

export function SettingsPage() {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const settings = await window.electronAPI?.settings?.loadMasked?.();
        if (!settings || cancelled) return;

        const { maskedApiKey: masked, ...rest } = settings;
        setForm(rest);
        setMaskedApiKey(masked);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load settings.');
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setLoadError(null);
    try {
      await window.electronAPI?.settings?.save?.(form);
      setSavedAt(new Date().toLocaleString('ko-KR'));
      if (form.apiKey) {
        setMaskedApiKey(`${form.apiKey.slice(0, 2)}${'*'.repeat(Math.max(form.apiKey.length - 4, 0))}${form.apiKey.slice(-2)}`);
        setForm((prev) => ({ ...prev, apiKey: '' }));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
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
          maxWidth: 720,
          margin: '0 auto',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
        }}
      >
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
              {'</>'}
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
              Settings
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
            Configure the OpenAI-compatible provider, protocol, and skill discovery roots for Curator Desktop.
          </p>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={sectionTitleStyle}>provider</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              <span>API Base URL</span>
              <input
                value={form.apiBaseUrl}
                onChange={(event) => updateField('apiBaseUrl', event.target.value)}
                placeholder="https://api.openai-compatible.local/v1"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              <span>API Key</span>
              <input
                type="password"
                value={form.apiKey}
                onChange={(event) => updateField('apiKey', event.target.value)}
                placeholder="sk-..."
                style={inputStyle}
              />
              {maskedApiKey ? (
                <span style={hintStyle}>Stored key: {maskedApiKey}. Leave blank to keep the existing key.</span>
              ) : (
                <span style={hintStyle}>Leave blank if you only want to use the mock backend in local UI tests.</span>
              )}
            </label>

            <label style={labelStyle}>
              <span>Model</span>
              <input
                value={form.model}
                onChange={(event) => updateField('model', event.target.value)}
                placeholder="gpt-4.1-mini"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              <span>Provider Protocol</span>
              <select
                value={form.providerProtocol}
                onChange={(event) => updateField('providerProtocol', event.target.value as AppSettings['providerProtocol'])}
                style={inputStyle}
              >
                <option value="chat">chat</option>
                <option value="responses">responses</option>
              </select>
            </label>

            <label style={labelStyle}>
              <span>Skill Root Paths</span>
              <textarea
                value={form.skillRootPaths.join('\n')}
                onChange={(event) =>
                  updateField(
                    'skillRootPaths',
                    event.target.value
                      .split(/\r?\n/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
                placeholder={'.codex/skills\nC:\\Users\\you\\.codex\\skills'}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 88 }}
              />
              <span style={hintStyle}>One path per line. Relative paths resolve from the repository root.</span>
            </label>
          </div>

          <div style={sectionTitleStyle}>app defaults</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>
              <span>Confluence Space Key</span>
              <input
                value={form.confluenceSpaceKey}
                onChange={(event) => updateField('confluenceSpaceKey', event.target.value)}
                placeholder="ENG"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              <span>Sync Interval Minutes</span>
              <input
                type="number"
                min={1}
                value={form.syncIntervalMinutes}
                onChange={(event) => updateField('syncIntervalMinutes', Number(event.target.value) || 1)}
                style={inputStyle}
              />
            </label>
          </div>

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
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {savedAt && <span style={{ ...hintStyle, color: 'var(--green)' }}>Saved at {savedAt}</span>}
            {loadError && <span style={{ ...hintStyle, color: 'var(--red)' }}>{loadError}</span>}
          </div>
        </form>
      </div>
    </main>
  );
}
