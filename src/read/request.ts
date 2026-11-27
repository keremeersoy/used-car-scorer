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

/** An older request means the panel was not opened by that click, so nothing is read. */
export const MAX_REQUEST_AGE_MS = 10_000;

interface RequestArea {
  get(key: string): Promise<Record<string, unknown>>;
  remove(key: string): Promise<void>;
}

/** Returns this window's fresh request, if any, and removes it so it is used only once. */
export async function takeReadRequest(
  area: RequestArea,
  windowId: number,
  now: number,
): Promise<ReadRequest | null> {
  const key = requestKey(windowId);
  const request = (await area.get(key))[key] as ReadRequest | undefined;
  if (!request) return null;
  await area.remove(key);
  return now - request.at <= MAX_REQUEST_AGE_MS ? request : null;
}
