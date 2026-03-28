import { getAllCards, rankCards } from "./rank";
import { getMerchantCategories } from "./categories";
import type { Card, UserStorage } from "./types";

const allCards = getAllCards();

let wallet: UserStorage = {
  userCards: [],
  pointValues: {},
  onboardingComplete: false,
  allCardsAdded: false,
  hiddenSites: [],
  siteCategories: {},
};

let detectedDomain: string | null = null;
let detectedCategories: string[] | null = null;

// ── DOM helpers ──

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

async function loadWallet(): Promise<void> {
  wallet = await chrome.runtime.sendMessage({ type: "GET_WALLET" });
}

async function addCard(cardId: string): Promise<void> {
  wallet = await chrome.runtime.sendMessage({ type: "ADD_CARD", cardId });
  if (!wallet.onboardingComplete && wallet.userCards.length >= 2) {
    chrome.runtime.sendMessage({ type: "SET_ONBOARDING_COMPLETE" });
    wallet.onboardingComplete = true;
  }
  render();
}

async function removeCard(cardId: string): Promise<void> {
  wallet = await chrome.runtime.sendMessage({ type: "REMOVE_CARD", cardId });
  render();
}

// ── Active tab detection ──

async function detectMerchant(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);
      const hostname = url.hostname.replace(/^www\./, "");

      // Skip chrome internal pages
      if (url.protocol === "chrome:" || url.protocol === "chrome-extension:") {
        detectedDomain = null;
        detectedCategories = null;
        return;
      }

      detectedDomain = hostname;
      detectedCategories = getMerchantCategories(hostname);
    }
  } catch {
    detectedDomain = null;
    detectedCategories = null;
  }
}

// ── Rendering ──

function renderWalletCards() {
  const container = $("wallet-cards");
  container.innerHTML = "";

  if (wallet.userCards.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No cards added yet.</p>
        <p>Search above to add your first card.</p>
      </div>
    `;
    return;
  }

  wallet.userCards.forEach((cardId) => {
    const card = allCards.find((c) => c.id === cardId);
    if (!card) return;

    const el = document.createElement("div");
    el.className = "card-item";
    el.innerHTML = `
      <div class="card-info">
        <span class="card-network ${card.network.toLowerCase()}">${card.network}</span>
        <span class="card-name">${card.name}</span>
      </div>
      <button class="remove-btn" data-id="${card.id}">&times;</button>
    `;
    container.appendChild(el);
  });

  container.querySelectorAll<HTMLButtonElement>(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => removeCard(btn.dataset.id!));
  });
}

function renderSearch(query: string) {
  const container = $("search-results");
  container.innerHTML = "";

  if (!query.trim()) {
    container.style.display = "none";
    return;
  }

  const q = query.toLowerCase();
  const matches = allCards.filter(
    (c) =>
      !wallet.userCards.includes(c.id) &&
      (c.name.toLowerCase().includes(q) ||
        c.network.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q))
  );

  if (matches.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  matches.forEach((card) => {
    const el = document.createElement("div");
    el.className = "search-item";
    el.innerHTML = `
      <span class="card-network ${card.network.toLowerCase()}">${card.network}</span>
      <span class="card-name">${card.name}</span>
    `;
    el.addEventListener("click", () => {
      addCard(card.id);
      (document.getElementById("card-search") as HTMLInputElement).value = "";
      renderSearch("");
    });
    container.appendChild(el);
  });
}

function renderMerchantStatus() {
  const container = $("merchant-status");
  const btn = $("find-best-btn") as HTMLButtonElement;
  const resultContainer = $("card-result");

  resultContainer.style.display = "none";

  if (!detectedDomain) {
    container.innerHTML = `<p class="no-merchant">Navigate to a merchant site to get a recommendation.</p>`;
    btn.disabled = true;
    btn.textContent = "Find My Best Card";
    return;
  }

  container.innerHTML = `
    <div class="merchant-info">
      <div class="merchant-dot"></div>
      <span class="merchant-domain">${detectedDomain}</span>
      <span class="merchant-category">${detectedCategories?.[0] ?? "general"}</span>
    </div>
  `;

  const hasCards = wallet.userCards.length > 0;
  btn.disabled = !hasCards;
  btn.textContent = hasCards
    ? `Find My Best Card for ${detectedCategories?.[0] ?? "general"}`
    : "Add a card first";
}

function showBestCard() {
  if (!detectedCategories || wallet.userCards.length === 0) return;

  const results = rankCards(wallet.userCards, detectedCategories, wallet.pointValues);
  if (results.length === 0) return;

  const top = results[0];
  const card = allCards.find((c) => c.name === top.cardName);
  if (!card) return;

  const networkClass = card.network.toLowerCase();
  const rateDisplay = `${top.effectiveRate.toFixed(1)}¢/$`;

  const isPoints = card.reward_type === "points";

  const container = $("card-result");
  container.style.display = "block";
  container.innerHTML = `
    <div class="card-visual ${networkClass}">
      <div class="card-visual-network">${card.network}</div>
      <div class="card-visual-chip"></div>
      <div class="card-visual-name">${card.name}</div>
    </div>
    <div class="result-details">
      <div class="result-card-name">${card.name}</div>
      <div class="result-rate">${rateDisplay}</div>
      <div class="result-reason">${top.reason} at ${detectedDomain}</div>
      ${isPoints ? `<div class="result-disclaimer">*Estimated value based on optimal point redemption (e.g. travel transfers)</div>` : ""}
    </div>
  `;
}

function renderFTUE() {
  const ftue = $("onboarding-ftue");
  if (!wallet.onboardingComplete && wallet.userCards.length < 2) {
    ftue.style.display = "block";
    if (wallet.userCards.length === 1) {
      ftue.querySelector(".ftue-title")!.textContent = "Great! Now add one more card";
      ftue.querySelector(".ftue-subtitle")!.textContent = "Swipe needs at least two cards to compare and find your best option.";
    }
  } else {
    ftue.style.display = "none";
  }
}

function renderAllCardsToggle() {
  const container = $("all-cards-toggle");
  const checkbox = $("all-cards-checkbox") as HTMLInputElement;
  if (wallet.userCards.length > 0) {
    container.style.display = "block";
    checkbox.checked = wallet.allCardsAdded;
  } else {
    container.style.display = "none";
  }
}

function render() {
  renderFTUE();
  renderWalletCards();
  renderAllCardsToggle();
  renderMerchantStatus();
}

// ── Init ──

function setupWelcomeMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("welcome") === "1") {
    document.body.classList.add("welcome-mode");
    $("pin-prompt").style.display = "block";
    $("done-btn-container").style.display = "block";
    $("done-btn").addEventListener("click", () => {
      window.close();
    });
  }
}

function setupPinPrompt() {
  const pinPrompt = $("pin-prompt");
  const pinDismissed = localStorage.getItem("swipe-pin-dismissed");

  // Show pin prompt if not dismissed (and not in welcome mode where it's always shown)
  if (!pinDismissed && !document.body.classList.contains("welcome-mode")) {
    if (!wallet.onboardingComplete) {
      pinPrompt.style.display = "block";
    }
  }

  $("pin-dismiss").addEventListener("click", () => {
    pinPrompt.style.display = "none";
    localStorage.setItem("swipe-pin-dismissed", "1");
  });
}

async function init() {
  setupWelcomeMode();

  await Promise.all([loadWallet(), detectMerchant()]);
  render();
  setupPinPrompt();

  // Notify the active tab's content script that the popup was opened (unhides the site)
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "POPUP_OPENED" });
    }
  } catch {}


  const searchInput = $("card-search") as HTMLInputElement;
  searchInput.addEventListener("input", () => renderSearch(searchInput.value));

  // Auto-focus search on first visit
  if (!wallet.onboardingComplete) {
    searchInput.focus();
  }

  $("find-best-btn").addEventListener("click", showBestCard);

  $("all-cards-checkbox").addEventListener("change", async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    wallet = await chrome.runtime.sendMessage({ type: "SET_ALL_CARDS_ADDED", value: checked });
  });
}

document.addEventListener("DOMContentLoaded", init);
