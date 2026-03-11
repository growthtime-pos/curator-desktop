import type { CSSProperties } from 'react';
import { HashRouter, NavLink } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';

const navStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  padding: 12,
  borderBottom: '1px solid #cbd5e1',
  background: '#fff',
};

const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  color: isActive ? '#1d4ed8' : '#334155',
  fontWeight: isActive ? 700 : 500,
  textDecoration: 'none',
});

export default function App() {
  return (
    <HashRouter>
      <nav style={navStyle}>
        <NavLink to="/chat" style={linkStyle}>
          Chat
        </NavLink>
        <NavLink to="/settings" style={linkStyle}>
          Settings
        </NavLink>
      </nav>
      <AppRoutes />
    </HashRouter>
  );
}
