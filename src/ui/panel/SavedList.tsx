import { useState } from 'react';
import { config } from '../../scoring/config';
import { scoreListing } from '../../scoring/score';
import type { Listing } from '../../types';
import { compareUrl } from '../compare/url';
import { ScoreRing } from '../ScoreRing';
import { factList, formatMoney, strings, verdictText } from '../strings';
import { verdict } from './insights';

export function SavedList({
  listings,
  onOpen,
  onRemove,
}: {
  listings: Listing[];
  onOpen: (listing: Listing) => void;
  onRemove: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const chosen = selected.filter((id) => listings.some((l) => l.id === id));
  const now = new Date();
  // Best first; listings without a score go last.
  const ranked = listings
    .map((listing) => ({ listing, result: scoreListing(listing, listings, now) }))
    .sort((a, b) => (b.result.total ?? -1) - (a.result.total ?? -1));

  if (listings.length === 0) return <p className="empty">{strings.noSaved}</p>;

  return (
    <>
      <ul className="saved">
        {ranked.map(({ listing, result }) => {
          const level = verdict(result, config);
          return (
            <li key={listing.id} className="card">
              <div className="saved-head">
                <ScoreRing score={result.total} level={level} />
                <div>
                  <h2>{listing.title ?? strings.untitled}</h2>
                  <p className="saved-verdict">
                    {verdictText[level].title}
                    {result.total === null ? '' : `, ${result.total} puan`}
                  </p>
                </div>
              </div>
              <ul className="facts">
                {[listing.price ? formatMoney(listing.price) : null, ...factList(listing)]
                  .filter((fact) => fact !== null)
                  .map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
              </ul>
              <div className="saved-meta">
                <label>
                  <input
                    type="checkbox"
                    data-select={listing.id}
                    checked={chosen.includes(listing.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...chosen, listing.id]
                          : chosen.filter((id) => id !== listing.id),
                      )
                    }
                  />
                  {strings.select}
                </label>
                {deleting === listing.id ? (
                  <span className="actions">
                    {strings.confirmDelete}
                    <button
                      type="button"
                      className="danger"
                      data-action="confirm-delete"
                      onClick={() => {
                        setDeleting(null);
                        onRemove(listing.id);
                      }}
                    >
                      {strings.confirmDeleteYes}
                    </button>
                    <button type="button" onClick={() => setDeleting(null)}>
                      {strings.cancel}
                    </button>
                  </span>
                ) : (
                  <span className="actions">
                    <button type="button" data-action="open" onClick={() => onOpen(listing)}>
                      {strings.open}
                    </button>
                    <button
                      type="button"
                      data-action="delete"
                      onClick={() => setDeleting(listing.id)}
                    >
                      {strings.remove}
                    </button>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="footer">
        <button
          type="button"
          className="primary"
          data-action="compare"
          disabled={chosen.length < 2}
          onClick={() =>
            void chrome.tabs.create({ url: chrome.runtime.getURL(compareUrl(chosen)) })
          }
        >
          {strings.compare}
          {chosen.length > 0 && ` (${chosen.length})`}
        </button>
        {chosen.length < 2 && <small>{strings.chooseTwo}</small>}
      </div>
    </>
  );
}
