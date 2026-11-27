/** A click on the toolbar icon, handed from the service worker to the side panel. */
export interface ReadRequest {
  windowId: number;
  tabId: number;
  at: number;
}

/** One key per window, so panels in different windows never take each other's requests. */
export function requestKey(windowId: number): string {
  return `readRequest:${windowId}`;
}
