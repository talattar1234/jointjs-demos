import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';

import { AppShell } from './app/app-shell.tsx';
import { DemoPage } from './app/demo-page.tsx';
import { DEFAULT_DEMO_PATH, demoPath, findLibrary } from './app/demo-registry.tsx';

/** Redirect legacy `/demo/:slug` links to their JointJS equivalent. */
function LegacyDemoRedirect(): ReactNode {
  const { slug } = useParams();
  return <Navigate to={demoPath('joint', slug ?? '')} replace />;
}

/** A bare `/:lib` visit resolves to that library's default demo. */
function LibraryIndexRedirect(): ReactNode {
  const { lib } = useParams();
  const library = findLibrary(lib);
  if (library === undefined) {
    return <Navigate to={DEFAULT_DEMO_PATH} replace />;
  }
  return <Navigate to={demoPath(library.id, library.defaultSlug)} replace />;
}

/**
 * Top-level routes. Each library (`joint`, `reactflow`) is a tab living under
 * the shared {@link AppShell}. The static `demo/:slug` route wins over the
 * dynamic `:lib` segment, so old links keep working.
 */
export function App(): ReactNode {
  return (
    <Routes>
      <Route index element={<Navigate to={DEFAULT_DEMO_PATH} replace />} />
      <Route path="demo/:slug" element={<LegacyDemoRedirect />} />
      <Route path=":lib" element={<AppShell />}>
        <Route index element={<LibraryIndexRedirect />} />
        <Route path="demo/:slug" element={<DemoPage />} />
      </Route>
      <Route path="*" element={<Navigate to={DEFAULT_DEMO_PATH} replace />} />
    </Routes>
  );
}
