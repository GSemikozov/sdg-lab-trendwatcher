import { DashboardPage } from '@pages/dashboard';
import { SettingsPage } from '@pages/settings';
import { useAppStore } from '@shared/lib/store';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './providers';

export function App() {
  const loadSpaces = useAppStore((s) => s.loadSpaces);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
