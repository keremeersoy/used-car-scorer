import { useCallback, useEffect, useState } from 'react';
import { isListingUrl, SITE_ACCESS } from '../../read/autoRead';

/** While the owner has granted site access, reads each listing they look at in this window. */
export function useAutoRead(read: (tabId: number) => void) {
  const [enabled, setEnabled] = useState(false);

  const refresh = useCallback(() => {
    void chrome.permissions.contains(SITE_ACCESS).then(setEnabled);
  }, []);

  useEffect(() => {
    refresh();
    chrome.permissions.onAdded.addListener(refresh);
    chrome.permissions.onRemoved.addListener(refresh);
    return () => {
      chrome.permissions.onAdded.removeListener(refresh);
      chrome.permissions.onRemoved.removeListener(refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    let windowId: number | undefined;
    let stopped = false;
    const consider = (tabId: number | undefined, url: string | undefined) => {
      if (!stopped && tabId !== undefined && url && isListingUrl(url)) read(tabId);
    };
    const onActivated = async (info: { tabId: number; windowId: number }) => {
      if (info.windowId !== windowId) return;
      // The tab may be closed again before it can be looked at.
      const tab = await chrome.tabs.get(info.tabId).catch(() => undefined);
      consider(info.tabId, tab?.url);
    };
    const onUpdated = (
      tabId: number,
      change: { status?: string },
      tab: { active?: boolean; windowId?: number; url?: string },
    ) => {
      if (change.status === 'complete' && tab.active && tab.windowId === windowId) {
        consider(tabId, tab.url);
      }
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    void chrome.windows.getCurrent().then(async (current) => {
      windowId = current.id;
      // The listing already open when this is turned on counts too.
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      consider(active?.id, active?.url);
    });
    return () => {
      stopped = true;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [enabled, read]);

  const toggle = () => {
    // request() must be the first call, or Chrome does not treat it as the owner's click.
    const change = enabled
      ? chrome.permissions.remove(SITE_ACCESS)
      : chrome.permissions.request(SITE_ACCESS);
    void change.then(refresh);
  };

  return { enabled, toggle };
}
