import { createSequence } from '../src/read/latest';
import { isSahibindenUrl, readTab } from '../src/read/readTab';
import { requestKey, takeReadRequest } from '../src/read/request';

test.each(['https://www.sahibinden.com/ilan/x', 'https://sahibinden.com/'])('reads %s', (url) =>
  expect(isSahibindenUrl(url)).toBe(true));

test.each([
  'https://sahibinden.com.evil.com/',
  'https://notsahibinden.com/',
  'https://evil.com/?u=sahibinden.com',
  'https://sahibinden.com@evil.com/',
  'file:///sahibinden.com',
  'junk',
])('refuses %s', (url) => expect(isSahibindenUrl(url)).toBe(false));

const api = (url: string | undefined, page = { html: '<p>', url: url! }) => ({
  getUrl: vi.fn(async () => url),
  copyPage: vi.fn(async () => page),
});

test('never injects elsewhere or without a visible URL', async () => {
  const other = api('https://example.com');
  expect(await readTab(1, other)).toEqual({ kind: 'notSahibinden' });
  const hidden = api(undefined);
  expect(await readTab(1, hidden)).toEqual({ kind: 'noAccess' });
  expect([...other.copyPage.mock.calls, ...hidden.copyPage.mock.calls]).toHaveLength(0);
});

test('reads, rechecks the returned URL, and maps injection errors', async () => {
  const url = 'https://www.sahibinden.com/ilan/x';
  expect(await readTab(1, api(url))).toEqual({ kind: 'ok', html: '<p>', url });
  expect(await readTab(1, api(url, { html: '', url: 'https://example.com' })))
    .toEqual({ kind: 'notSahibinden' });
  const broken = {
    getUrl: async () => url,
    copyPage: async (): Promise<never> => {
      throw new Error('x');
    },
  };
  expect(await readTab(1, broken)).toEqual({ kind: 'noAccess' });
});

function fakeSession(initial: Record<string, unknown>) {
  const data = structuredClone(initial);
  return {
    data,
    get: async (key: string): Promise<Record<string, unknown>> =>
      key in data ? { [key]: data[key] } : {},
    remove: async (key: string): Promise<void> => {
      delete data[key];
    },
  };
}

test('a request is taken once and expires', async () => {
  const make = (at: number) =>
    fakeSession({ [requestKey(7)]: { windowId: 7, tabId: 3, at } });
  const area = make(1_000);
  expect(await takeReadRequest(area, 7, 2_000)).toMatchObject({ tabId: 3 });
  expect(await takeReadRequest(area, 7, 2_000)).toBeNull();
  const old = make(1_000);
  expect(await takeReadRequest(old, 7, 11_001)).toBeNull();
  expect(old.data).toEqual({});
  expect(await takeReadRequest(make(1_000), 8, 2_000)).toBeNull();
});

test('only the newest run is current', () => {
  const begin = createSequence();
  const first = begin();
  const second = begin();
  expect([first(), second()]).toEqual([false, true]);
});
