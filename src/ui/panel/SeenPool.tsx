import { useState } from 'react';
import { strings } from '../strings';

/** How many listings are remembered for comparison, with a way to forget them. */
export function SeenPool({ count, onClear }: { count: number; onClear: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <section className="backup">
      <h3>{strings.poolTitle}</h3>
      <p className="quiet">{strings.poolHint}</p>
      <div className="actions">
        <span>
          {strings.poolCount} {count}
        </span>
        {asking ? (
          <>
            <button
              type="button"
              className="danger"
              data-action="confirm-clear-seen"
              onClick={() => {
                setAsking(false);
                onClear();
              }}
            >
              {strings.poolClearConfirm}
            </button>
            <button type="button" onClick={() => setAsking(false)}>
              {strings.cancel}
            </button>
          </>
        ) : (
          <button
            type="button"
            data-action="clear-seen"
            disabled={count === 0}
            onClick={() => setAsking(true)}
          >
            {strings.poolClear}
          </button>
        )}
      </div>
    </section>
  );
}
