import type { UserStorage } from "./types";

const DEFAULT_STORAGE: UserStorage = {
  userCards: [],
  pointValues: {},
  onboardingComplete: false,
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
});
