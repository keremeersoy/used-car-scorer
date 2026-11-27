import { useState } from 'react';
import { scoreListing } from '../../scoring/score';
import type { Listing } from '../../types';
import { compareUrl } from '../compare/url';
import { formatMoney, strings } from '../strings';

export function SavedList({
  listings, onOpen, onRemove,
}: {
  listings: Listing[];
  onOpen: (listing: Listing) => void;
  onRemove: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const chosen = selected.filter((id) => listings.some((l) => l.id === id));
  const now = new Date();

  if (listings.length === 0) return <p className="empty">{strings.noSaved}</p>;

  return (
    <>
      <ul className="saved">
        {listings.map((listing) => (
          <li key={listing.id} className="card">
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
              <span className="saved-title">{listing.title ?? strings.untitled}</span>
              <strong className="saved-score">
                {scoreListing(listing, listings, now).total ?? '—'}
              </strong>
            </label>
            <div className="saved-meta">
              <span>
                #{listing.id} · {listing.price === null ? '—' : formatMoney(listing.price)}
              </span>
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
                  <button type="button" onClick={() => setDeleting(null)}>{strings.cancel}</button>
                </span>
              ) : (
                <span className="actions">
                  <button type="button" data-action="open" onClick={() => onOpen(listing)}>
                    {strings.open}
                  </button>
                  <button type="button" data-action="delete" onClick={() => setDeleting(listing.id)}>
                    {strings.remove}
                  </button>
                </span>
              )}
            </div>
          </li>
        ))}
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
      </div>
    </>
  );
}
