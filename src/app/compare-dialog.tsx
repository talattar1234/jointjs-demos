import { useEffect, useRef, type ReactNode } from 'react';

import {
  COMPARISON_CAVEAT,
  COMPARISON_COLUMNS,
  COMPARISON_MAX_POINTS,
  COMPARISON_ROWS,
  COMPARISON_SCORES,
  COMPARISON_VERDICTS,
  formatPoints,
  rowPoints,
  WEIGHT_LABELS,
  type CompareLibraryId,
} from '../data/comparison.ts';

/** The top-scoring library, and whether it shares the top score with another. */
function overallResult(): { readonly leaders: readonly CompareLibraryId[]; readonly topPoints: number } {
  const topPoints = COMPARISON_SCORES[0]?.points ?? 0;
  return {
    leaders: COMPARISON_SCORES.filter((score) => score.points === topPoints).map((score) => score.id),
    topPoints,
  };
}

/** Column label for a library id, for use in prose. */
function labelOf(id: CompareLibraryId): string {
  return COMPARISON_COLUMNS.find((column) => column.id === id)?.label ?? id;
}

/** Renders the weight as a compact `×N` chip with an explanatory title. */
function WeightChip({ weight }: Readonly<{ weight: number }>): ReactNode {
  return (
    <span className="cmp__weight" title={`Weight ${weight} — ${WEIGHT_LABELS[weight] ?? ''}`}>
      ×{weight}
    </span>
  );
}

/**
 * A modal table comparing the three diagramming libraries axis by axis, with a
 * weighted score per axis and an overall winner. Content comes from
 * `src/data/comparison.ts`; this component only presents it.
 *
 * Closes on Escape and on backdrop click. Focus moves to the close button on open
 * and returns to whatever was focused before.
 */
export function CompareDialog({ onClose }: Readonly<{ onClose: () => void }>): ReactNode {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  const { leaders, topPoints } = overallResult();
  const isTiedOverall = leaders.length > 1;

  return (
    <div className="cmp-backdrop" onClick={onClose}>
      <div
        className="cmp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmp-title"
        // The backdrop closes on click; clicks inside the panel must not bubble to it.
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cmp__head">
          <div>
            <h2 className="cmp__title" id="cmp-title">
              JointJS vs React Flow vs GoJS
            </h2>
            <p className="cmp__sub">
              Scored from building the same 13 demos on all three. {COMPARISON_ROWS.length} axes, weighted 1–3 points
              each, {COMPARISON_MAX_POINTS} points available.
            </p>
          </div>
          <button ref={closeRef} type="button" className="cmp__close" onClick={onClose} aria-label="Close comparison">
            ✕
          </button>
        </header>

        <div className="cmp__body">
          <table className="cmp__table">
            <thead>
              <tr>
                <th scope="col" className="cmp__axis-head">
                  Axis
                </th>
                {COMPARISON_COLUMNS.map((column) => (
                  <th key={column.id} scope="col">
                    <span className="cmp__lib">{column.label}</span>
                    <span className="cmp__pkg">{column.packages}</span>
                    <span className="cmp__cost">{column.cost}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="cmp__axis">
                    <span className="cmp__axis-name">
                      {row.category}
                      <WeightChip weight={row.weight} />
                    </span>
                    <span className="cmp__axis-detail">{row.detail}</span>
                  </th>
                  {COMPARISON_COLUMNS.map((column) => {
                    const isWinner = row.winners.includes(column.id);
                    const isShared = isWinner && row.winners.length > 1;
                    return (
                      <td key={column.id} className={isWinner ? 'cmp__cell cmp__cell--win' : 'cmp__cell'}>
                        {isWinner && (
                          <span className="cmp__badge">
                            {isShared ? 'tie' : 'wins'} +{formatPoints(rowPoints(row, column.id))}
                          </span>
                        )}
                        <span className="cmp__text">{row.cells[column.id]}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="cmp__totals">
                <th scope="row" className="cmp__axis">
                  <span className="cmp__axis-name">Total</span>
                  <span className="cmp__axis-detail">Weighted points of {COMPARISON_MAX_POINTS}</span>
                </th>
                {COMPARISON_COLUMNS.map((column) => {
                  const score = COMPARISON_SCORES.find((entry) => entry.id === column.id);
                  const points = score?.points ?? 0;
                  const isLeader = leaders.includes(column.id);
                  return (
                    <td key={column.id} className={isLeader ? 'cmp__cell cmp__total cmp__total--win' : 'cmp__cell cmp__total'}>
                      <span className="cmp__score">
                        {isLeader && <span aria-hidden>🏆 </span>}
                        {formatPoints(points)}
                        <span className="cmp__score-max"> / {COMPARISON_MAX_POINTS}</span>
                      </span>
                      <span className="cmp__bar" aria-hidden>
                        <span className="cmp__bar-fill" style={{ width: `${(points / COMPARISON_MAX_POINTS) * 100}%` }} />
                      </span>
                      <span className="cmp__wins">
                        {score?.outrightWins ?? 0} {score?.outrightWins === 1 ? 'axis' : 'axes'} won outright
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>

          <div className="cmp__verdict">
            <p className="cmp__verdict-line">
              <strong>Overall:</strong>{' '}
              {isTiedOverall
                ? `${leaders.map(labelOf).join(' and ')} tie on ${formatPoints(topPoints)} of ${COMPARISON_MAX_POINTS} points.`
                : `${labelOf(leaders[0] ?? 'joint')} takes it on ${formatPoints(topPoints)} of ${COMPARISON_MAX_POINTS} points — but the margin is small enough that the right answer depends on which rows matter to you.`}
            </p>
            <ul className="cmp__picks">
              {COMPARISON_SCORES.map((score) => (
                <li key={score.id} className="cmp__pick">
                  <span className="cmp__pick-lib">{labelOf(score.id)}</span>
                  <span className="cmp__pick-text">{COMPARISON_VERDICTS[score.id]}</span>
                </li>
              ))}
            </ul>
            <p className="cmp__caveat">{COMPARISON_CAVEAT}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
