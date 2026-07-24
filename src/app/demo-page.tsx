import { useParams } from 'react-router-dom';
import type { ReactNode } from 'react';

import { findDemo } from './demo-registry.tsx';

/** Resolves the `:slug` param to a demo and renders it, or a placeholder. */
export function DemoPage(): ReactNode {
  const { slug } = useParams();
  const demo = findDemo(slug);

  if (demo === undefined) {
    return <div className="demo-empty">Unknown demo.</div>;
  }

  return (
    <div className="demo">
      <header className="demo__header">
        <div className="demo__eyebrow">Demo {demo.tag}</div>
        <h1 className="demo__title">{demo.title}</h1>
        <p className="demo__tagline">{demo.tagline}</p>
      </header>

      <div className="demo__body">
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
