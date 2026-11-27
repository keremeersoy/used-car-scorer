// @vitest-environment jsdom
// The panel against a fake chrome API: reading, saving and their races.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toBackup } from '../src/storage/backup';
import { STORE_KEY } from '../src/storage/listings';
import type { Listing } from '../src/types';
import { App } from '../src/ui/panel/App';
import { listing } from './helpers';

const URL_7 = 'https://www.sahibinden.com/ilan/test-7/detay';
const PAGE_7 = `<div class="classifiedDetailTitle"><h1>Sayfadaki ilan</h1></div>
  <div class="classifiedInfo"><h3 class="classifiedPriceValue">500.000 TL</h3>
  <dl><dd id="classifiedId">7</dd></dl></div>`;

type Area = Record<string, unknown>;

function event() {
  const listeners = new Set<(...args: unknown[]) => void>();
  return {
    addListener: (listener: (...args: unknown[]) => void) => void listeners.add(listener),
    removeListener: (listener: (...args: unknown[]) => void) => void listeners.delete(listener),
    emit: (...args: unknown[]) => {
      for (const listener of listeners) listener(...args);
    },
  };
}

function fakeChrome(saved: Listing[], session: Area = {}) {
  const local: Area = {
    [STORE_KEY]: { version: 1, listings: Object.fromEntries(saved.map((l) => [l.id, l])) },
  };
  const listeners = { addListener: () => {}, removeListener: () => {} };
  const access = { granted: false, requests: 0, added: event(), removed: event() };
  // Tests replace these to delay or break a call.
  const hooks = {
    tabUrl: URL_7,
    copy: async () => ({ html: PAGE_7, url: URL_7 }),
    beforeGet: async (): Promise<void> => {},
    beforeSet: async (): Promise<void> => {},
  };
  const chrome = {
    storage: {
      local: {
        get: async (key: string) => {
          await hooks.beforeGet();
          return structuredClone({ [key]: local[key] });
        },
        set: async (items: Area) => {
          await hooks.beforeSet();
          Object.assign(local, structuredClone(items));
        },
        onChanged: listeners,
      },
      session: {
        get: async (key: string) => (key in session ? { [key]: session[key] } : {}),
        remove: async (key: string) => void delete session[key],
        onChanged: listeners,
      },
    },
    windows: { getCurrent: async () => ({ id: 1 }) },
    tabs: {
      query: async () => [{ id: 5, url: hooks.tabUrl }],
      get: async () => ({ url: hooks.tabUrl }),
      onActivated: event(),
      onUpdated: event(),
    },
    permissions: {
      contains: async () => access.granted,
      request: async () => {
        access.requests++;
        access.granted = true;
        access.added.emit();
        return true;
      },
      remove: async () => {
        access.granted = false;
        access.removed.emit();
        return true;
      },
      onAdded: undefined as unknown,
      onRemoved: undefined as unknown,
    },
    scripting: { executeScript: async () => [{ result: await hooks.copy() }] },
  };
  const stored = () => (local[STORE_KEY] as { listings: Record<string, Listing> }).listings;
  chrome.permissions.onAdded = access.added;
  chrome.permissions.onRemoved = access.removed;
  return { chrome, hooks, stored, access };
}

function gate() {
  let open!: () => void;
  const closed = new Promise<void>((resolve) => (open = resolve));
  return { closed, open };
}

let root: Root;
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function start(fake: ReturnType<typeof fakeChrome>) {
  vi.stubGlobal('chrome', fake.chrome);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('scrollTo', () => {}); // jsdom does not scroll
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: (_: string, task: () => Promise<unknown>) => task() },
  });
  const container = document.body.appendChild(document.createElement('div'));
  root = createRoot(container);
  await act(async () => root.render(<App />));
  await settle();
}

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const find = <T extends Element>(selector: string) => document.querySelector<T>(selector)!;
const field = (name: string) => find<HTMLInputElement>(`[data-field="${name}"]`);
const click = async (selector: string) => {
  await act(async () => {
    // SVG shapes have no click() method, so the event is sent directly.
    find<Element>(selector).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle();
};
const type = async (name: string, value: string) => {
  await act(async () => {
    const input = field(name);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const openSaved = async () => {
  await click('[data-tab="saved"]');
  await click('[data-action="open"]');
};
const text = () => document.body.textContent!;

test('a waiting icon click is read when the panel opens', async () => {
  const request = { windowId: 1, tabId: 5, at: Date.now() };
  await start(fakeChrome([], { 'readRequest:1': request }));
  expect(field('title').value).toBe('Sayfadaki ilan');
  expect(field('price').value).toBe('500.000');
});

test('a listing opened during a slow read is not replaced when the read lands', async () => {
  const fake = fakeChrome([listing({ id: '2', title: 'Kayıtlı ilan' })]);
  const slow = gate();
  fake.hooks.copy = async () => {
    await slow.closed;
    return { html: PAGE_7, url: URL_7 };
  };
  await start(fake);
  await click('[data-action="reread"]');
  await openSaved();
  slow.open();
  await settle();
  expect(field('title').value).toBe('Kayıtlı ilan');
});

test('editing during a save neither loses the edit nor asks to overwrite', async () => {
  const fake = fakeChrome([listing({ id: '7', savedAt: '2026-01-01T00:00:00.000Z' })]);
  await start(fake);
  await click('[data-action="reread"]');
  await type('km', '1000');
  const slow = gate();
  fake.hooks.beforeSet = () => slow.closed;
  await click('[data-action="save"]');
  await type('km', '2000');
  slow.open();
  await settle();
  fake.hooks.beforeSet = async () => {};
  await click('[data-action="save"]');
  expect(text()).not.toContain('Üzerine yazılsın mı?');
  expect(fake.stored()['7']!.km).toBe(2000);
});

test('saved data that cannot be read during a page read is reported and not written over', async () => {
  const fake = fakeChrome([listing({ id: '7', damageRecordTL: 9_000 })]);
  await start(fake);
  fake.hooks.beforeGet = async () => {
    throw new Error('disk');
  };
  await click('[data-action="reread"]');
  expect(text()).toContain('Kayıtlı veriler okunamadı');
  // The browser's own error text is English, so it never reaches the interface.
  expect(text()).not.toContain('disk');
  await click('[data-action="save"]');
  expect(fake.stored()['7']!.damageRecordTL).toBe(9_000);
});

test('a backup file is restored from the saved tab, and a wrong file is explained', async () => {
  const fake = fakeChrome([]);
  await start(fake);
  await click('[data-tab="saved"]');
  const choose = async (content: string) => {
    const input = find<HTMLInputElement>('[data-action="restore"]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ size: content.length, text: async () => content }],
    });
    await act(async () => void input.dispatchEvent(new Event('change', { bubbles: true })));
    await settle();
  };
  await choose('junk');
  expect(text()).toContain('Yedek dosyası okunamadı');
  await choose(toBackup([listing({ id: '9', title: 'Yedekten gelen' })], new Date()));
  expect(fake.stored()['9']!.title).toBe('Yedekten gelen');
  expect(text()).toContain('1 eklendi');
});

test('a change made in another window is not overwritten without asking', async () => {
  const fake = fakeChrome([listing({ id: '2', km: 100 })]);
  await start(fake);
  await openSaved();
  fake.stored()['2']!.km = 200; // another window saves, keeping the same date
  await type('referencePrice', '5');
  await click('[data-action="save"]');
  expect(text()).toContain('Üzerine yazılsın mı?');
  expect(fake.stored()['2']!.km).toBe(200);
  await click('[data-action="overwrite"]');
  expect(fake.stored()['2']).toMatchObject({ km: 100, referencePrice: 5 });
});

test('a second click during a save does nothing', async () => {
  const fake = fakeChrome([]);
  await start(fake);
  await click('[data-action="reread"]');
  await type('km', '1');
  let writes = 0;
  const slow = gate();
  fake.hooks.beforeSet = async () => {
    writes++;
    await slow.closed;
  };
  await click('[data-action="save"]');
  await click('[data-action="save"]');
  slow.open();
  await settle();
  expect(writes).toBe(1);
  expect(text()).not.toContain('Üzerine yazılsın mı?');
});

test('a backup with one broken entry loads the rest and names the broken one', async () => {
  const fake = fakeChrome([]);
  await start(fake);
  await click('[data-tab="saved"]');
  const content = JSON.stringify({
    app: 'usedCarScorer',
    version: 1,
    listings: [listing({ id: '9' }), { ...listing({ id: '10' }), price: -5 }],
  });
  const input = find<HTMLInputElement>('[data-action="restore"]');
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [{ size: content.length, text: async () => content }],
  });
  await act(async () => void input.dispatchEvent(new Event('change', { bubbles: true })));
  await settle();
  expect(Object.keys(fake.stored())).toEqual(['9']);
  expect(text()).toContain('1 eklendi');
  expect(text()).toContain('#10 (Fiyat (TL))');
});

const LISTING_7 = 'https://www.sahibinden.com/ilan/test-ilani-1000000007/detay';
const visit = async (fake: ReturnType<typeof fakeChrome>, url: string, id: string, tabId = 5) => {
  fake.hooks.tabUrl = url;
  fake.hooks.copy = async () => ({ html: PAGE_7.replace('>7<', `>${id}<`), url });
  await act(async () => {
    fake.chrome.tabs.onUpdated.emit(
      tabId,
      { status: 'complete' },
      { active: true, windowId: 1, url },
    );
  });
  await settle();
};

test('nothing is read on navigation until automatic reading is turned on', async () => {
  const fake = fakeChrome([]);
  await start(fake);
  await visit(fake, LISTING_7, '7');
  expect(field('title')).toBeNull();
  await click('[data-action="auto-read"]');
  expect(fake.access.requests).toBe(1);
  expect(field('title').value).toBe('Sayfadaki ilan');
});

test('with it on, each listing visited is read and other pages are ignored', async () => {
  const fake = fakeChrome([]);
  fake.access.granted = true;
  await start(fake);
  await visit(fake, LISTING_7, '7');
  expect(field('id').value).toBe('7');
  await visit(fake, 'https://www.sahibinden.com/otomobil', '99');
  expect(field('id').value).toBe('7');
  await visit(fake, LISTING_7.replace('07/', '08/'), '8');
  expect(field('id').value).toBe('8');
});

test('typed values are not lost by browsing, and going back drops the question', async () => {
  const fake = fakeChrome([]);
  fake.access.granted = true;
  await start(fake);
  await visit(fake, LISTING_7, '7');
  await type('km', '1000');
  await visit(fake, LISTING_7.replace('07/', '08/'), '8');
  expect(text()).toContain('Kaydedilmemiş değişiklikler var');
  expect(field('id').value).toBe('7');
  await visit(fake, LISTING_7, '7');
  expect(text()).not.toContain('Kaydedilmemiş değişiklikler var');
  expect(field('km').value).toBe('1000');
});

test('turning it off gives the access back and stops reading', async () => {
  const fake = fakeChrome([]);
  fake.access.granted = true;
  fake.hooks.tabUrl = 'https://www.sahibinden.com/otomobil';
  await start(fake);
  await click('[data-action="auto-read"]');
  expect(fake.access.granted).toBe(false);
  await visit(fake, LISTING_7, '7');
  expect(field('title')).toBeNull();
});

test('a part is set by choosing it on the car diagram', async () => {
  const fake = fakeChrome([]);
  await start(fake);
  await click('[data-action="reread"]');
  await click('[data-part="roof"]');
  await click('[data-status="painted"]');
  expect(find('[data-part="roof"]').getAttribute('data-value')).toBe('painted');
  expect(text()).toContain('Tavan');
});

const slowRead = async (fake: ReturnType<typeof fakeChrome>) => {
  const slow = gate();
  fake.access.granted = true;
  fake.hooks.tabUrl = 'https://www.sahibinden.com/otomobil';
  await start(fake);
  fake.hooks.tabUrl = LISTING_7;
  // A bot check: a listing address whose page cannot be read.
  fake.hooks.copy = async () => {
    await slow.closed;
    return { html: '<p>', url: LISTING_7 };
  };
  await click('[data-action="reread"]');
  return slow;
};

test('an automatic read of the same tab does not swallow a clicked one', async () => {
  const fake = fakeChrome([]);
  const slow = await slowRead(fake);
  await act(async () => {
    fake.chrome.tabs.onUpdated.emit(
      5,
      { status: 'complete' },
      { active: true, windowId: 1, url: LISTING_7 },
    );
  });
  slow.open();
  await settle();
  expect(text()).toContain('İlan okunamadı');
});

test('another tab is still read automatically while a clicked read is running', async () => {
  const fake = fakeChrome([]);
  const slow = await slowRead(fake);
  await visit(fake, LISTING_7.replace('07/', '08/'), '8', 6);
  slow.open();
  await settle();
  expect(field('id').value).toBe('8');
});

test('a tab whose clicked read was overtaken is read automatically again', async () => {
  const fake = fakeChrome([listing({ id: '2' })]);
  const slow = await slowRead(fake);
  await openSaved(); // overtakes the clicked read without starting another one
  slow.open();
  await settle();
  await visit(fake, LISTING_7, '7');
  expect(field('id').value).toBe('7');
});

test('browsing leaves the saved list open unless a different listing appears', async () => {
  const fake = fakeChrome([]);
  fake.access.granted = true;
  await start(fake);
  await visit(fake, LISTING_7, '7');
  await click('[data-tab="saved"]');
  const savedIsOpen = () => find('[data-tab="saved"]').getAttribute('aria-current') === 'page';
  await visit(fake, LISTING_7, '7'); // the same listing, for example after switching tabs
  expect(savedIsOpen()).toBe(true);
  await visit(fake, LISTING_7.replace('07/', '08/'), '8');
  expect(savedIsOpen()).toBe(false);
});

const LISTING_8 = LISTING_7.replace('07/', '08/');
const autoPanel = async (saved: Listing[] = []) => {
  const fake = fakeChrome(saved);
  fake.access.granted = true;
  fake.hooks.tabUrl = 'https://www.sahibinden.com/otomobil';
  await start(fake);
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  return { fake, scroll };
};

test('a new listing starts at the top, and the same one keeps its place', async () => {
  const { fake, scroll } = await autoPanel();
  await visit(fake, LISTING_7, '7');
  expect(scroll).toHaveBeenCalledWith(0, 0);
  scroll.mockClear();
  await visit(fake, LISTING_7, '7');
  expect(scroll).not.toHaveBeenCalled();
});

test('the unsaved changes question is brought into view', async () => {
  const { fake, scroll } = await autoPanel();
  await visit(fake, LISTING_7, '7');
  await type('km', '1000');
  scroll.mockClear();
  await visit(fake, LISTING_8, '8');
  expect(text()).toContain('Kaydedilmemiş değişiklikler var');
  expect(scroll).toHaveBeenCalledWith(0, 0);
});

test('a listing saved before says so and offers an update', async () => {
  const { fake } = await autoPanel([listing({ id: '7' })]);
  const saveLabel = () => find('[data-action="save"]').textContent;
  await visit(fake, LISTING_7, '7');
  expect(find('[data-testid="saved-badge"]').textContent).toBe('Kayıtlı');
  expect(saveLabel()).toBe('Güncelle');
  await visit(fake, LISTING_8, '8');
  expect(find('[data-testid="saved-badge"]')).toBeNull();
  expect(saveLabel()).toBe('Kaydet');
});

test('a tab closed before it can be looked at is ignored', async () => {
  const { fake } = await autoPanel();
  const rejections: unknown[] = [];
  const record = (reason: unknown) => void rejections.push(reason);
  process.on('unhandledRejection', record);
  fake.chrome.tabs.get = async () => {
    throw new Error('No tab with id');
  };
  await act(async () => void fake.chrome.tabs.onActivated.emit({ tabId: 9, windowId: 1 }));
  await settle();
  process.off('unhandledRejection', record);
  expect(rejections).toEqual([]);
});

const writeNote = async (value: string) => {
  await act(async () => {
    const area = find<HTMLTextAreaElement>('[data-field="note"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, value);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

test('a note is saved, survives reading the page again and shows in the saved list', async () => {
  const fake = fakeChrome([]);
  await start(fake);
  await click('[data-action="reread"]');
  await writeNote('Pazarlık payı var');
  await click('[data-action="save"]');
  expect(fake.stored()['7']!.note).toBe('Pazarlık payı var');
  await click('[data-action="reread"]');
  expect(find<HTMLTextAreaElement>('[data-field="note"]').value).toBe('Pazarlık payı var');
  await click('[data-tab="saved"]');
  expect(find('.saved-note').textContent).toBe('Pazarlık payı var');
});
