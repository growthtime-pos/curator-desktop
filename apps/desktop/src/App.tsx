import { BrowserRouter, Link } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #cbd5e1', background: '#fff' }}>
        <Link to="/chat">Chat</Link>
        <Link to="/settings">Settings</Link>
      </nav>
      <AppRoutes />
    </BrowserRouter>
  );
}
