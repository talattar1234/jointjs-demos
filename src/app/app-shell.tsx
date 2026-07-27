import { Link, Navigate, NavLink, Outlet, useMatch, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';

import {
  DEFAULT_DEMO_PATH,
  demoPath,
  findLibrary,
  LIBRARIES,
  type Library,
} from './demo-registry.tsx';
import { useTheme } from './theme.tsx';

/**
 * Keep the demo the user is looking at when they switch library tabs, so only the
 * package changes. Falls back to the tab's default when it lacks that demo.
 */
function tabPath(library: Library, currentSlug: string | undefined): string {
  const hasSameDemo = library.demos.some((demo) => demo.slug === currentSlug && demo.ready);
  return demoPath(library.id, hasSameDemo && currentSlug !== undefined ? currentSlug : library.defaultSlug);
}

/** Persistent chrome: brand, library tabs, sidebar navigation, theme toggle. */
export function AppShell(): ReactNode {
  const { theme, toggleTheme } = useTheme();
  const { lib } = useParams();
  // `slug` lives on the child route, so it is not in this layout's own params.
  const demoMatch = useMatch('/:lib/demo/:slug');
  const currentSlug = demoMatch?.params.slug;
  const activeLibrary = findLibrary(lib);

  if (activeLibrary === undefined) {
    return <Navigate to={DEFAULT_DEMO_PATH} replace />;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            ◆
          </span>
          <span className="brand__text">
            Diagram <span className="brand__accent">Showcase</span>
          </span>
        </div>

        <div className="libtabs" role="tablist" aria-label="Diagramming library">
          {LIBRARIES.map((library) => (
            <Link
              key={library.id}
              to={tabPath(library, currentSlug)}
              role="tab"
              aria-selected={library.id === activeLibrary.id}
              className={`libtab${library.id === activeLibrary.id ? ' libtab--active' : ''}`}
            >
              {library.label}
            </Link>
          ))}
        </div>

        <p className="sidebar__hint">{activeLibrary.blurb}</p>

        <nav className="nav" aria-label="Demos">
          {activeLibrary.demos.map((demo) => (
            <NavLink
              key={demo.slug}
              to={demoPath(activeLibrary.id, demo.slug)}
              className={({ isActive }) => `nav__item${isActive ? ' nav__item--active' : ''}`}
            >
              <span className="nav__tag">{demo.tag}</span>
              <span className="nav__body">
                <span className="nav__title">{demo.title}</span>
                <span className="nav__tagline">{demo.tagline}</span>
              </span>
              {!demo.ready && <span className="nav__soon">soon</span>}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
        </button>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
