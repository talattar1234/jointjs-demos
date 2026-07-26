import { Navigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';

import { DEFAULT_DEMO_PATH, findDemo, findLibrary } from './demo-registry.tsx';

/** Resolves the `:lib`/`:slug` params to a demo and renders it, or a placeholder. */
export function DemoPage(): ReactNode {
  const { lib, slug } = useParams();
  const library = findLibrary(lib);
  if (library === undefined) {
    return <Navigate to={DEFAULT_DEMO_PATH} replace />;
  }

  const demo = findDemo(lib, slug);
  if (demo === undefined) {
    return <div className="demo-empty">Unknown demo.</div>;
  }

  return (
    <div className="demo">
      <header className="demo__header">
        <div className="demo__eyebrow">
          {library.label} · Demo {demo.tag}
        </div>
        <h1 className="demo__title">{demo.title}</h1>
        <p className="demo__tagline">{demo.tagline}</p>
      </header>

      <div className={`demo__body${demo.scroll === true ? ' demo__body--scroll' : ''}`}>
        {demo.ready && demo.Component ? <demo.Component /> : <ComingSoon />}
      </div>
    </div>
  );
}

function ComingSoon(): ReactNode {
  return (
    <div className="coming-soon">
      <div className="coming-soon__badge">Coming soon</div>
      <p>This demo is on the build list and will light up shortly.</p>
    </div>
  );
}
