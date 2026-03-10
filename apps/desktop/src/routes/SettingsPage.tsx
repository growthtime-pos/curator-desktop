import { FormEvent, useState } from 'react';
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

export function SettingsPage() {
  const [form, setForm] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    await window.electronAPI?.settings?.save?.(form);
    setSavedAt(new Date().toLocaleString('ko-KR'));
  };

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 12 }}>
      <h1>설정</h1>
      <form onSubmit={handleSave} style={{ display: 'grid', gap: 12 }}>
        <label>
          사내 API Base URL
          <input value={form.apiBaseUrl} onChange={(e) => updateField('apiBaseUrl', e.target.value)} placeholder="https://api.internal.example" />
        </label>

        <label>
          API Key
          <input type="password" value={form.apiKey} onChange={(e) => updateField('apiKey', e.target.value)} placeholder="sk-..." />
        </label>

        <label>
          Model
          <input value={form.model} onChange={(e) => updateField('model', e.target.value)} placeholder="gpt-4.1-mini" />
        </label>

        <label>
          Confluence Space 키
          <input value={form.confluenceSpaceKey} onChange={(e) => updateField('confluenceSpaceKey', e.target.value)} placeholder="ENG" />
        </label>

        <label>
          동기화 주기 (분)
          <input
            type="number"
            min={1}
            value={form.syncIntervalMinutes}
            onChange={(e) => updateField('syncIntervalMinutes', Number(e.target.value) || 1)}
          />
        </label>

        <button type="submit" style={{ width: 140, padding: '10px 14px' }}>
          설정 저장
        </button>
      </form>
      {savedAt && <p style={{ marginTop: 12, color: '#334155' }}>마지막 저장: {savedAt}</p>}
    </main>
  );
}
