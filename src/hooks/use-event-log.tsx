import { useCallback, useRef, useState } from 'react';

/** Visual tone of a log row. */
export type LogTone = 'info' | 'accent' | 'warn';

/** A single recorded event. */
export interface LogEntry {
  readonly id: number;
  readonly time: string;
  readonly label: string;
  readonly detail?: string;
  readonly tone: LogTone;
}

export interface EventLogApi {
  readonly entries: readonly LogEntry[];
  readonly push: (label: string, detail?: string, tone?: LogTone) => void;
  readonly clear: () => void;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Collects a bounded, newest-first list of events for the event-inspector demo. */
export function useEventLog(limit = 120): EventLogApi {
  const [entries, setEntries] = useState<readonly LogEntry[]>([]);
  const nextId = useRef(0);

  const push = useCallback(
    (label: string, detail?: string, tone: LogTone = 'info') => {
      nextId.current += 1;
      const now = new Date();
      const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const entry: LogEntry = { id: nextId.current, time, label, detail, tone };
      setEntries((prev) => [entry, ...prev].slice(0, limit));
    },
    [limit]
  );

  const clear = useCallback(() => setEntries([]), []);

  return { entries, push, clear };
}
