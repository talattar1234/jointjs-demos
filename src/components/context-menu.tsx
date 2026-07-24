import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** A single actionable row in the context menu. */
export interface MenuItem {
  readonly label: string;
  readonly onSelect: () => void;
  readonly danger?: boolean;
  readonly disabled?: boolean;
}

/** Open state for the context menu: screen coordinates, an optional title, items. */
export interface MenuState {
  readonly x: number;
  readonly y: number;
  readonly title?: string;
  readonly items: readonly MenuItem[];
}

const VIEWPORT_MARGIN = 8;
const FALLBACK_WIDTH = 200;
const FALLBACK_HEIGHT = 40;

/**
 * A custom React context menu positioned at screen coordinates and clamped to
 * the viewport. Closes on outside pointerdown, scroll, resize, and Escape.
 */
export function ContextMenu({ state, onClose }: Readonly<{ state: MenuState | null; onClose: () => void }>): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (state === null) {
      setPos(null);
      return;
    }
    const element = ref.current;
    const width = element?.offsetWidth ?? FALLBACK_WIDTH;
    const height = element?.offsetHeight ?? FALLBACK_HEIGHT;
    setPos({
      left: Math.max(VIEWPORT_MARGIN, Math.min(state.x, window.innerWidth - width - VIEWPORT_MARGIN)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(state.y, window.innerHeight - height - VIEWPORT_MARGIN)),
    });
  }, [state]);

  useEffect(() => {
    if (state === null) {
      return;
    }
    const close = () => onClose();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [state, onClose]);

  if (state === null) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: pos?.left ?? state.x, top: pos?.top ?? state.y }}
      // Keep pointerdown inside the menu from bubbling to the window close handler.
      onPointerDown={(event) => event.stopPropagation()}
    >
      {state.title !== undefined && <div className="ctx-menu__title">{state.title}</div>}
      {state.items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`ctx-menu__item${item.danger === true ? ' ctx-menu__item--danger' : ''}`}
          disabled={item.disabled}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
