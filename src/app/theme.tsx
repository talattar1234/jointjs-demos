import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** The two visual themes the app supports. */
export type ThemeName = 'dark' | 'light';

interface ThemeContextValue {
  readonly theme: ThemeName;
  readonly toggleTheme: () => void;
}

const STORAGE_KEY = 'jjdemo.theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeName {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return 'dark';
}

/**
 * Provides the active theme to the tree and reflects it onto the root
 * `data-theme` attribute so CSS variables can switch wholesale.
 */
export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  const [theme, setTheme] = useState<ThemeName>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

/** Access the active theme and a toggle. Throws outside a {@link ThemeProvider}. */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return value;
}
