import type { ReactNode } from 'react';

import type { EventLogApi } from '../hooks/use-event-log.tsx';

/** Side panel that renders the event log with a clear button. */
export function EventLog({ log }: Readonly<{ log: EventLogApi }>): ReactNode {
  return (
    <div className="eventlog">
      <div className="eventlog__head">
        <span className="eventlog__title">Event log</span>
        <button type="button" className="eventlog__clear" onClick={log.clear} disabled={log.entries.length === 0}>
          Clear
        </button>
      </div>
      <div className="eventlog__list">
        {log.entries.length === 0 ? (
          <div className="eventlog__empty">Interact with the diagram to see events…</div>
        ) : (
          log.entries.map((entry) => (
            <div key={entry.id} className={`eventlog__row eventlog__row--${entry.tone}`}>
              <span className="eventlog__time">{entry.time}</span>
              <span className="eventlog__label">{entry.label}</span>
              {entry.detail !== undefined && <span className="eventlog__detail">{entry.detail}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
