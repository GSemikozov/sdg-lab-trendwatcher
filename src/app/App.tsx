import { CreateSpacePage } from '@pages/create-space';
import { SpaceDashboardPage } from '@pages/dashboard';
import { HomePage } from '@pages/home';
import { SpaceSettingsPage } from '@pages/settings';
import { useAppStore } from '@shared/lib/store';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout';
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
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/spaces/new" element={<CreateSpacePage />} />
            <Route path="/spaces/:slug" element={<SpaceDashboardPage />} />
            <Route path="/spaces/:slug/settings" element={<SpaceSettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
