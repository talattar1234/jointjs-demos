import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';

import { DEMOS } from './demo-registry.tsx';
import { useTheme } from './theme.tsx';

/** Persistent chrome: brand, sidebar navigation, theme toggle, routed content. */
export function AppShell(): ReactNode {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            ◆
          </span>
          <span className="brand__text">
            JointJS <span className="brand__accent">React</span>
          </span>
        </div>
        <p className="sidebar__hint">Interactive showcase · free stack</p>

        <nav className="nav" aria-label="Demos">
          {DEMOS.map((demo) => (
            <NavLink
              key={demo.slug}
              to={`/demo/${demo.slug}`}
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
