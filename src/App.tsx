import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

import { AppShell } from './app/app-shell.tsx';
import { DemoPage } from './app/demo-page.tsx';
import { DEFAULT_DEMO_SLUG } from './app/demo-registry.tsx';

/** Top-level routes: everything lives under the shared {@link AppShell}. */
export function App(): ReactNode {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={`/demo/${DEFAULT_DEMO_SLUG}`} replace />} />
        <Route path="demo/:slug" element={<DemoPage />} />
        <Route path="*" element={<Navigate to={`/demo/${DEFAULT_DEMO_SLUG}`} replace />} />
      </Route>
    </Routes>
  );
}
