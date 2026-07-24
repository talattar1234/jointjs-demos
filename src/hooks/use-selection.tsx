import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePaper } from '@joint/react';
import type { dia } from '@joint/core';

interface SelectionContextValue {
  readonly selectedId: dia.Cell.ID | null;
  readonly select: (id: dia.Cell.ID | null) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

/**
 * Holds the single-selection state shared across a demo. Clicking (demo b) and
 * selecting by code (demo d) both write here, so they can never disagree.
 * Pressing Escape clears the selection.
 */
export function SelectionProvider({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  const [selectedId, setSelectedId] = useState<dia.Cell.ID | null>(null);
  const select = useCallback((id: dia.Cell.ID | null) => setSelectedId(id), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo<SelectionContextValue>(() => ({ selectedId, select }), [selectedId, select]);
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

/** Read/write the shared selection. Throws outside a {@link SelectionProvider}. */
export function useSelection(): SelectionContextValue {
  const value = useContext(SelectionContext);
  if (value === null) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return value;
}

/**
 * Applies an `is-selected` class to the selected cell's view (element or link),
 * so selection is styled purely in CSS. Mount inside the `<Paper>`'s provider.
 * Runs every render so the class survives view remounts.
 */
export function SelectionLayer(): ReactNode {
  const { selectedId } = useSelection();
  const { paper } = usePaper();
  const previousId = useRef<dia.Cell.ID | null>(null);

  useEffect(() => {
    if (paper === null) {
      return;
    }
    const toggle = (id: dia.Cell.ID | null, on: boolean) => {
      if (id === null) {
        return;
      }
      const view = paper.findViewByModel(id);
      view?.el.classList.toggle('is-selected', on);
    };
    if (previousId.current !== selectedId) {
      toggle(previousId.current, false);
    }
    toggle(selectedId, true);
    previousId.current = selectedId;
  });

  return null;
}
