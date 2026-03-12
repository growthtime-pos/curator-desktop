import type { CSSProperties } from 'react';
import { HashRouter, NavLink } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';

const navStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  padding: '0 16px',
  borderBottom: '1px solid var(--border-primary)',
  background: 'var(--bg-secondary)',
  height: 44,
  WebkitAppRegion: 'drag',
} satisfies Record<string, unknown>;

const logoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginRight: 24,
  WebkitAppRegion: 'no-drag',
} satisfies Record<string, unknown>;

const logoIconStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  background: 'linear-gradient(135deg, var(--accent), #c4694a)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 700,
  color: '#fff',
};

const logoTextStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
  fontSize: 13,
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em',
};

const linkBase = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  fontWeight: 500,
  textDecoration: 'none',
  padding: '8px 14px',
  borderRadius: 'var(--radius-sm)',
  transition: 'all 0.15s ease',
  WebkitAppRegion: 'no-drag',
} satisfies Record<string, unknown>;

const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  ...linkBase,
  color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
  background: isActive ? 'var(--accent-dim)' : 'transparent',
});

const versionStyle = {
  marginLeft: 'auto',
  fontSize: 11,
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  WebkitAppRegion: 'no-drag',
} satisfies Record<string, unknown>;

export default function App() {
  return (
    <HashRouter>
      <nav style={navStyle}>
        <div style={logoStyle}>
          <div style={logoIconStyle}>C</div>
          <span style={logoTextStyle}>Curator</span>
        </div>
        <NavLink to="/chat" style={linkStyle}>
          {'>'} chat
        </NavLink>
        <NavLink to="/settings" style={linkStyle}>
          {'>'} settings
        </NavLink>
        <span style={versionStyle}>v0.1.0</span>
      </nav>
      <AppRoutes />
    </HashRouter>
  );
}
