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

function fakeChrome(saved: Listing[], session: Area = {}) {
  const local: Area = {
    [STORE_KEY]: { version: 1, listings: Object.fromEntries(saved.map((l) => [l.id, l])) },
  };
  const listeners = { addListener: () => {}, removeListener: () => {} };
  // Tests replace these to delay or break a call.
  const hooks = {
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
    tabs: { query: async () => [{ id: 5 }], get: async () => ({ url: URL_7 }) },
    scripting: { executeScript: async () => [{ result: await hooks.copy() }] },
  };
  const stored = () => (local[STORE_KEY] as { listings: Record<string, Listing> }).listings;
  return { chrome, hooks, stored };
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
  await act(async () => find<HTMLElement>(selector).click());
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
  expect(text()).toContain('disk');
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
