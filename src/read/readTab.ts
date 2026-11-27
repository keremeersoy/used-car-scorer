export type ReadOutcome =
  | { kind: 'ok'; html: string; url: string }
  | { kind: 'notSahibinden' }
  | { kind: 'noAccess' };

export interface TabApi {
  getUrl(tabId: number): Promise<string | undefined>;
  copyPage(tabId: number): Promise<{ html: string; url: string }>;
}

export const chromeTabApi: TabApi = {
  async getUrl(tabId) {
    return (await chrome.tabs.get(tabId)).url;
  },
  async copyPage(tabId) {
    // Runs in the page: it only copies what is already there and changes nothing.
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
    });
    if (!injection?.result) throw new Error('The page returned nothing');
    return injection.result;
  },
};

export function isSahibindenUrl(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'https:' && protocol !== 'http:') return false;
  return hostname === 'sahibinden.com' || hostname.endsWith('.sahibinden.com');
}

export async function readTab(tabId: number, api: TabApi): Promise<ReadOutcome> {
  try {
    const url = await api.getUrl(tabId);
    // Chrome hides the URL of a tab the extension has no access to.
    if (url === undefined) return { kind: 'noAccess' };
    if (!isSahibindenUrl(url)) return { kind: 'notSahibinden' };
    const page = await api.copyPage(tabId);
    // The tab may have moved on between the check and the copy.
    if (!isSahibindenUrl(page.url)) return { kind: 'notSahibinden' };
    return { kind: 'ok', ...page };
  } catch {
    return { kind: 'noAccess' };
  }
}
