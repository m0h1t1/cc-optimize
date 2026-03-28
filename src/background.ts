import type { UserStorage } from "./types";

const DEFAULT_STORAGE: UserStorage = {
  userCards: [],
  pointValues: {},
  onboardingComplete: false,
  allCardsAdded: false,
  hiddenSites: [],
  siteCategories: {},
};

async function getStorage(): Promise<UserStorage> {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_STORAGE, (data) => {
      resolve(data as UserStorage);
    });
  });
}

async function setStorage(updates: Partial<UserStorage>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(updates, resolve);
  });
}

// Open welcome tab on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?welcome=1") });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_WALLET") {
    getStorage().then((data) => sendResponse(data));
    return true; // async response
  }

  if (message.type === "ADD_CARD") {
    getStorage().then(async (data) => {
      if (!data.userCards.includes(message.cardId)) {
        data.userCards.push(message.cardId);
        await setStorage({ userCards: data.userCards });
      }
      sendResponse(data);
    });
    return true;
  }

  if (message.type === "REMOVE_CARD") {
    getStorage().then(async (data) => {
      data.userCards = data.userCards.filter((id) => id !== message.cardId);
      await setStorage({ userCards: data.userCards });
      sendResponse(data);
    });
    return true;
  }

  if (message.type === "SET_CPP") {
    getStorage().then(async (data) => {
      data.pointValues[message.cardId] = message.value;
      await setStorage({ pointValues: data.pointValues });
      sendResponse(data);
    });
    return true;
  }

  if (message.type === "SET_ONBOARDING_COMPLETE") {
    setStorage({ onboardingComplete: true }).then(() => sendResponse(true));
    return true;
  }

  if (message.type === "SET_ALL_CARDS_ADDED") {
    getStorage().then(async (data) => {
      data.allCardsAdded = message.value;
      await setStorage({ allCardsAdded: data.allCardsAdded });
      sendResponse(data);
    });
    return true;
  }

  if (message.type === "HIDE_SITE") {
    getStorage().then(async (data) => {
      const sites = data.hiddenSites || [];
      if (!sites.includes(message.domain)) {
        sites.push(message.domain);
        await setStorage({ hiddenSites: sites });
      }
      sendResponse(true);
    });
    return true;
  }

  if (message.type === "OPEN_POPUP") {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    sendResponse(true);
    return true;
  }

  if (message.type === "SET_SITE_CATEGORY") {
    getStorage().then(async (data) => {
      const cats = data.siteCategories || {};
      cats[message.domain] = message.categories;
      await setStorage({ siteCategories: cats });
      sendResponse(true);
    });
    return true;
  }

  if (message.type === "UNHIDE_SITE") {
    getStorage().then(async (data) => {
      const sites = (data.hiddenSites || []).filter((s: string) => s !== message.domain);
      await setStorage({ hiddenSites: sites });
      sendResponse(true);
    });
    return true;
  }
});
