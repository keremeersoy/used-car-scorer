import { useCallback, useEffect, useRef, useState } from 'react';
import { toListing, type Draft } from '../../draft/draft';
import { extract } from '../../extract/extract';
import { unrecognised } from '../../extract/types';
import { createSequence } from '../../read/latest';
import { chromeTabApi, readTab, type ReadOutcome } from '../../read/readTab';
import { requestKey, takeReadRequest } from '../../read/request';
import { config } from '../../scoring/config';
import { scoreListing } from '../../scoring/score';
import { noticeText, strings } from '../strings';
import { useListings } from '../useListings';
import { ListingForm } from './ListingForm';
import {
  afterSave, discardAndReplace, initialState, keepCurrent, receive, savedWhileEditing,
  wouldOverwrite, type ReadResult,
} from './panelState';
import { ReplacePrompt } from './ReplacePrompt';
import { SavedList } from './SavedList';
import { ScoreCard } from './ScoreCard';

const partLabel = (key: string) =>
  config.damage.parts.find((part) => part.key === key)?.label ?? key;

function toResult(outcome: ReadOutcome): ReadResult {
  if (outcome.kind !== 'ok') return outcome;
  try {
    // The parsed copy is inert: nothing in it runs or loads, and only its text is used.
    const doc = new DOMParser().parseFromString(outcome.html, 'text/html');
    return { kind: 'page', ...extract(doc, outcome.url) };
  } catch {
    return { kind: 'page', ...unrecognised(outcome.url) };
  }
}

export function App() {
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState<'listing' | 'saved'>('listing');
  const [formValid, setFormValid] = useState(true);
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);
  const [savedRevision, setSavedRevision] = useState<number | null>(null);
  const { listings, error, load, save, remove } = useListings();
  const begin = useRef(createSequence()).current;

  const read = useCallback(
    async (tabId: number) => {
      const isCurrent = begin();
      const result = toResult(await readTab(tabId, chromeTabApi));
      // Read the saved data now, so typed values are merged even right after the panel opens.
      const saved = (await load()) ?? [];
      if (!isCurrent()) return;
      setState((current) => receive(current, result, saved));
      setTab('listing');
    },
    [begin, load],
  );

  // A page is read only after a click: the toolbar icon (a request) or "Tekrar oku".
  useEffect(() => {
    let windowId: number | undefined;
    const take = async () => {
      if (windowId === undefined) return;
      const request = await takeReadRequest(chrome.storage.session, windowId, Date.now());
      if (request) await read(request.tabId);
    };
    const onChanged = (changes: Record<string, { newValue?: unknown }>) => {
      if (windowId !== undefined && changes[requestKey(windowId)]?.newValue) void take();
    };
    chrome.storage.session.onChanged.addListener(onChanged);
    void chrome.windows.getCurrent().then((current) => {
      windowId = current.id;
      void take();
    });
    return () => chrome.storage.session.onChanged.removeListener(onChanged);
  }, [read]);

  const reread = async () => {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id !== undefined) await read(active.id);
  };

  const { draft } = state;
  useEffect(() => setConfirmingOverwrite(false), [state.revision, draft?.listing.id]);

  const canSave = draft !== null && draft.listing.id !== '' && formValid;

  const saveDraft = async (confirmed = false) => {
    if (!draft || !canSave) return;
    const before = await load();
    if (!before) return; // without the saved data an overwrite could not be noticed
    if (!confirmed && wouldOverwrite(draft, before)) {
      setConfirmingOverwrite(true);
      return;
    }
    setConfirmingOverwrite(false);
    const entry = toListing(draft, new Date());
    try {
      await save(entry);
    } catch {
      return; // the error is shown and the draft stays unsaved
    }
    const saved = (await load()) ?? [];
    const { revision } = state;
    setState((current) => {
      if (current.draft === draft) return afterSave(current, saved);
      if (current.revision !== revision) return current; // another listing is shown now
      return savedWhileEditing(current, saved, entry.id.trim());
    });
    setSavedRevision(revision);
  };

  const change = (apply: (current: Draft) => Draft) =>
    setState((current) =>
      current.draft ? { ...current, draft: apply(current.draft) } : current,
    );

  const justSaved = draft !== null && !draft.dirty && savedRevision === state.revision;

  return (
    <main>
      <header>
        <nav>
          {(['listing', 'saved'] as const).map((name) => (
            <button
              key={name}
              type="button"
              data-tab={name}
              aria-current={tab === name ? 'page' : undefined}
              onClick={() => setTab(name)}
            >
              {name === 'listing' ? strings.tabListing : `${strings.tabSaved} (${listings.length})`}
            </button>
          ))}
        </nav>
        <button type="button" data-action="reread" onClick={() => void reread()}>
          {strings.reread}
        </button>
      </header>

      {error && <p className="banner error" role="alert">{error}</p>}

      {/* Both tabs stay mounted so half-typed values survive switching. */}
      <div hidden={tab !== 'listing'}>
        {state.notices.map((notice) => (
          <p key={notice} className="banner" role="status">
            {noticeText[notice]}
            {notice === 'unreadable' && `. ${strings.fillByHand}`}
          </p>
        ))}
        {state.pending && (
          <ReplacePrompt
            canSave={canSave}
            onSave={() => void saveDraft()}
            onDiscard={() =>
              void load().then((saved) =>
                setState((current) => discardAndReplace(current, saved ?? [])),
              )
            }
            onStay={() => setState(keepCurrent)}
          />
        )}
        {draft ? (
          <>
            <p className="listing-heading">
              <strong>{draft.listing.title ?? strings.untitled}</strong>
              {draft.listing.id && <span>#{draft.listing.id}</span>}
            </p>
            <ScoreCard
              result={scoreListing(draft.listing, listings, new Date())}
              partLabel={partLabel}
            />
            <ListingForm
              key={state.revision}
              draft={draft}
              onChange={change}
              onValidity={setFormValid}
            />
            <div className="footer">
              {confirmingOverwrite ? (
                <div className="actions">
                  <span>{strings.overwrite}</span>
                  <button type="button" className="danger" data-action="overwrite" onClick={() => void saveDraft(true)}>
                    {strings.overwriteConfirm}
                  </button>
                  <button type="button" onClick={() => setConfirmingOverwrite(false)}>
                    {strings.cancel}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="primary"
                    data-action="save"
                    disabled={!canSave}
                    onClick={() => void saveDraft()}
                  >
                    {justSaved ? strings.saved : strings.save}
                  </button>
                  {!canSave && (
                    <small>{formValid ? strings.needId : strings.fixInvalid}</small>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <p className="empty">{strings.clickIconToRead}</p>
        )}
      </div>

      <div hidden={tab !== 'saved'}>
        <SavedList
          listings={listings}
          onOpen={(listing) => {
            begin(); // a read still in progress must not replace what was just opened
            setState((current) => receive(current, { kind: 'saved', listing }, listings));
            setTab('listing');
          }}
          onRemove={(id) => void remove(id).catch(() => undefined)}
        />
      </div>
    </main>
  );
}
