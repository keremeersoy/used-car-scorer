import { useState } from 'react';
import { parseBackup, toBackup } from '../../storage/backup';
import type { RestoreResult } from '../../storage/listings';
import type { Listing } from '../../types';
import { rejectedSummary, restoreSummary, strings } from '../strings';

// Far above what the browser can store, so only a wrong file is this large.
const MAX_BYTES = 20 * 1024 * 1024;

function download(listings: Listing[]) {
  const now = new Date();
  const url = URL.createObjectURL(
    new Blob([toBackup(listings, now)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `arac-skoru-yedek-${now.toISOString().slice(0, 10)}.json`;
  link.click();
  // Revoking at once can cancel the download that was just started.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function Backup({
  listings, onRestore,
}: {
  listings: Listing[];
  onRestore: (entries: Listing[]) => Promise<RestoreResult>;
}) {
  const [message, setMessage] = useState<string | null>(null);

  const restore = async (file: File) => {
    if (file.size > MAX_BYTES) return setMessage(strings.backupTooLarge);
    let backup: ReturnType<typeof parseBackup>;
    try {
      backup = parseBackup(await file.text());
    } catch {
      return setMessage(strings.backupUnreadable);
    }
    try {
      const { added, updated, skipped } = await onRestore(backup.listings);
      setMessage(
        [restoreSummary(added, updated, skipped), rejectedSummary(backup.rejected)].join(' ').trim(),
      );
    } catch {
      setMessage(null); // the storage error is already shown
    }
  };

  return (
    <section className="backup">
      <div className="actions">
        <button
          type="button"
          data-action="export"
          disabled={listings.length === 0}
          onClick={() => download(listings)}
        >
          {strings.exportBackup}
        </button>
        <label className="file-button">
          {strings.restoreBackup}
          <input
            type="file"
            accept="application/json,.json"
            data-action="restore"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ''; // so the same file can be chosen again
              if (file) void restore(file);
            }}
          />
        </label>
      </div>
      {message && <p className="banner" role="status">{message}</p>}
    </section>
  );
}
