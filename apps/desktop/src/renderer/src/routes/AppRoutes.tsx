import { Navigate, Route, Routes } from 'react-router-dom';
import { ChatPage } from './ChatPage';
import { SettingsPage } from './SettingsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
