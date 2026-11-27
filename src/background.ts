import { requestKey, type ReadRequest } from './read/request';

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  // open() must run before any await, or Chrome rejects it as not user-initiated.
  void chrome.sidePanel.open({ windowId: tab.windowId });
  const request: ReadRequest = { windowId: tab.windowId, tabId: tab.id, at: Date.now() };
  void chrome.storage.session.set({ [requestKey(tab.windowId)]: request });
});
