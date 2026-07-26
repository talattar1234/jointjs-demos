import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Highlight, themes } from 'prism-react-renderer';

import { useTheme } from '../app/theme.tsx';

/** One documented snippet: a title, a one-line why, the code, and an optional live demo. */
export interface Snippet {
  readonly id: string;
  readonly title: string;
  readonly desc: string;
  readonly code: string;
  /** Slug of the demo that uses this pattern (resolved against `basePath`). */
  readonly demo?: string;
}

/** Code with Prism syntax highlighting, themed to match the app. */
function CodeBlock({ code }: Readonly<{ code: string }>): ReactNode {
  const { theme } = useTheme();
  const prismTheme = theme === 'dark' ? themes.oneDark : themes.oneLight;
  return (
    <Highlight code={code} language="tsx" theme={prismTheme}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre className="code__pre" style={{ background: 'transparent' }}>
          {tokens.map((line, lineIndex) => (
            <div key={lineIndex} {...getLineProps({ line })}>
              {line.map((token, tokenIndex) => (
                <span key={tokenIndex} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

function SnippetCard({ item, basePath }: Readonly<{ item: Snippet; basePath: string }>): ReactNode {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(item.code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <section className="snippet">
      <div className="snippet__head">
        <div>
          <h2 className="snippet__title">{item.title}</h2>
          <p className="snippet__desc">{item.desc}</p>
        </div>
        {item.demo !== undefined && (
          <Link className="snippet__demo" to={`${basePath}/${item.demo}`}>
            → live demo
          </Link>
        )}
      </div>
      <div className="code">
        <button type="button" className="copy-btn" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <CodeBlock code={item.code} />
      </div>
    </section>
  );
}

interface CookbookProps {
  readonly intro: ReactNode;
  readonly snippets: readonly Snippet[];
  /** Base route for the "live demo" links, e.g. `/joint/demo`. */
  readonly basePath: string;
}

/** Shared cookbook page: an intro paragraph followed by copyable snippet cards. */
export function Cookbook({ intro, snippets, basePath }: Readonly<CookbookProps>): ReactNode {
  return (
    <div className="cookbook">
      <p className="cookbook__intro">{intro}</p>
      {snippets.map((item) => (
        <SnippetCard key={item.id} item={item} basePath={basePath} />
      ))}
    </div>
  );
}
