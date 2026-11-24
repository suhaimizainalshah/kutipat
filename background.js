/* Kutipat background. No tracking, and no network requests.
   Kutipat handles the toolbar click itself, rather than letting Chrome open the panel automatically, because only a
   handled click reliably grants access to the page (activeTab) and tells Kutipat which site it is. The address is kept
   only in this browser session (chrome.storage.session), in memory, and is never sent anywhere. */
const setup = () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
setup();
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {}); // must run straight away, while the click still counts
  if (tab.url) {
    chrome.storage.session.set({ ["seen:" + tab.id]: tab.url }).catch(() => {});
    chrome.runtime.sendMessage({ type: "kutipat-activated", tabId: tab.id, url: tab.url }).catch(() => {}); // an open panel retries
  }
});

/* ---------- the address bar: kutip opens Kutipat on this page ---------- */
chrome.omnibox.setDefaultSuggestion({ description: "Kutipat: press Enter to collect data from <match>this page</match>" });
chrome.omnibox.onInputEntered.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); if (!tab) return;
  if (tab.url) chrome.storage.session.set({ ["seen:" + tab.id]: tab.url }).catch(() => {});
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => { // if Chrome doesn’t count this as a click, point to the toolbar button
    chrome.action.setBadgeText({ text: "!", tabId: tab.id }); chrome.action.setTitle({ title: "Click here to open Kutipat on this page", tabId: tab.id }); });
});
