import { useCallback, useEffect, useRef, useState } from 'react';
import { type Draft, toListing } from '../../draft/draft';
import { extract } from '../../extract/extract';
import { unrecognised } from '../../extract/types';
import { createSequence } from '../../read/latest';
import { chromeTabApi, type ReadOutcome, readTab } from '../../read/readTab';
import { requestKey, takeReadRequest } from '../../read/request';
import { config } from '../../scoring/config';
import { scoreListing } from '../../scoring/score';
import { ConflictError } from '../../storage/listings';
import type { Listing } from '../../types';
import { CarDiagram } from '../CarDiagram';
import { noticeText, strings } from '../strings';
import { useListings } from '../useListings';
import { Backup } from './Backup';
import { Breakdown } from './Breakdown';
import { findings, missingInfo, verdict } from './insights';
import { ListingForm } from './ListingForm';
import {
  afterSave,
  discardAndReplace,
  expectedEntry,
  initialState,
  keepCurrent,
  type ReadResult,
  receive,
  receiveAuto,
  savedWhileEditing,
} from './panelState';
import { ReplacePrompt } from './ReplacePrompt';
import { SavedList } from './SavedList';
import { Findings, Summary } from './Summary';
import { useAutoRead } from './useAutoRead';

type Conflict = { replacing: Listing | null };

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
  // Set when saving would replace something this draft did not start from.
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [savedRevision, setSavedRevision] = useState<number | null>(null);
  const { listings, error, load, save, remove, restore } = useListings();
  const begin = useRef(createSequence()).current;

  // The clicked read that is still running, if any.
  const clickedRead = useRef<{ tabId: number } | null>(null);

  const read = useCallback(
    async (tabId: number, how: typeof receive | typeof receiveAuto = receive) => {
      // An automatic read stays quiet about unreadable pages, so it must not replace a click.
      if (how === receiveAuto && clickedRead.current?.tabId === tabId) return;
      const click = how === receive ? { tabId } : null;
      if (click) clickedRead.current = click;
      const isCurrent = begin();
      try {
        const result = toResult(await readTab(tabId, chromeTabApi));
        // Read the saved data now, so typed values are merged even right after the panel opens.
        const saved = (await load()) ?? [];
        if (!isCurrent()) return;
        setState((current) => how(current, result, saved));
        setTab('listing');
      } finally {
        // Cleared even when overtaken, or this tab would never be read automatically again.
        if (click && clickedRead.current === click) clickedRead.current = null;
      }
    },
    [begin, load],
  );
  const autoRead = useAutoRead(
    useCallback((tabId: number) => void read(tabId, receiveAuto), [read]),
  );

  // Without automatic reading, a page is read only after a click: the icon or "Tekrar oku".
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: these changes make a pending question stale
  useEffect(() => setConflict(null), [state.revision, draft?.listing.id]);

  const canSave = draft !== null && draft.listing.id !== '' && formValid;

  const saving = useRef(false);

  const saveDraft = async (confirmed?: Conflict) => {
    if (!draft || !canSave || saving.current) return;
    saving.current = true;
    try {
      setConflict(null);
      const entry = toListing(draft, new Date());
      const id = entry.id.trim();
      try {
        await save(entry, confirmed ?? { replacing: expectedEntry(draft) });
      } catch (cause) {
        // Any other error is already shown and the draft stays unsaved.
        if (!(cause instanceof ConflictError)) return;
        const current = await load();
        if (current) setConflict({ replacing: current.find((l) => l.id === id) ?? null });
        return;
      }
      const saved = (await load()) ?? [];
      const { revision } = state;
      setState((current) => {
        if (current.draft === draft) return afterSave(current, saved);
        if (current.revision !== revision) return current; // another listing is shown now
        return savedWhileEditing(current, saved, id);
      });
      setSavedRevision(revision);
    } finally {
      saving.current = false;
    }
  };

  const change = (apply: (current: Draft) => Draft) =>
    setState((current) => (current.draft ? { ...current, draft: apply(current.draft) } : current));

  const justSaved = draft !== null && !draft.dirty && savedRevision === state.revision;
  const result = draft && scoreListing(draft.listing, listings, new Date());

  return (
    <main>
      <header>
        <div className="top">
          <nav>
            {(['listing', 'saved'] as const).map((name) => (
              <button
                key={name}
                type="button"
                data-tab={name}
                aria-current={tab === name ? 'page' : undefined}
                onClick={() => setTab(name)}
              >
                {name === 'listing' ? strings.tabListing : strings.tabSaved}
                {name === 'saved' && <span className="count">{listings.length}</span>}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={autoRead.enabled}
            data-action="auto-read"
            title={autoRead.enabled ? strings.autoReadOnHint : strings.autoReadConsent}
            onClick={autoRead.toggle}
          >
            <span className="knob" aria-hidden="true" />
            {strings.autoRead}
          </button>
        </div>
      </header>

      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}

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
        {draft && result ? (
          <>
            <Summary listing={draft.listing} result={result} level={verdict(result, config)} />
            <Findings
              findings={findings(draft.listing, result, partLabel, config)}
              missing={missingInfo(draft.listing, config)}
            />
            <ListingForm
              key={state.revision}
              draft={draft}
              onChange={change}
              onValidity={setFormValid}
            />
            <Breakdown result={result} partLabel={partLabel} />
            <button
              type="button"
              className="link reread"
              data-action="reread"
              onClick={() => void reread()}
            >
              {strings.reread}
            </button>
            <div className="footer">
              {conflict ? (
                <div className="actions">
                  <span>{strings.overwrite}</span>
                  <button
                    type="button"
                    className="danger"
                    data-action="overwrite"
                    onClick={() => void saveDraft(conflict)}
                  >
                    {strings.overwriteConfirm}
                  </button>
                  <button type="button" onClick={() => setConflict(null)}>
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
                  {!canSave && <small>{formValid ? strings.needId : strings.fixInvalid}</small>}
                </>
              )}
            </div>
          </>
        ) : (
          <section className="empty">
            <CarDiagram parts={{}} />
            <h1>{strings.emptyTitle}</h1>
            <p>{autoRead.enabled ? strings.emptyAuto : strings.emptyManual}</p>
            {!autoRead.enabled && (
              <>
                <button type="button" className="primary" onClick={autoRead.toggle}>
                  {strings.autoReadEnable}
                </button>
                <small>{strings.autoReadConsent}</small>
              </>
            )}
            <button
              type="button"
              className="link"
              data-action="reread"
              onClick={() => void reread()}
            >
              {strings.readThisTab}
            </button>
          </section>
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
        {/* After a read error the list may be stale, so it is not offered for backup. */}
        <Backup listings={error ? [] : listings} onRestore={restore} />
      </div>
    </main>
  );
}
