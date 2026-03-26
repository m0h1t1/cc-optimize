import { getAllCards, rankCards } from "./rank";
import type { Card, UserStorage } from "./types";

const allCards = getAllCards();

let wallet: UserStorage = {
  userCards: [],
  pointValues: {},
  onboardingComplete: false,
};

// ── DOM helpers ──

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

async function loadWallet(): Promise<void> {
  wallet = await chrome.runtime.sendMessage({ type: "GET_WALLET" });
}

async function addCard(cardId: string): Promise<void> {
  wallet = await chrome.runtime.sendMessage({ type: "ADD_CARD", cardId });
  render();
}

async function removeCard(cardId: string): Promise<void> {
  wallet = await chrome.runtime.sendMessage({ type: "REMOVE_CARD", cardId });
  render();
}

// ── Rendering ──

function renderWalletCards() {
  const container = $("wallet-cards");
  container.innerHTML = "";

  if (wallet.userCards.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No cards added yet.</p>
        <p>Search below to add your first card.</p>
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

function renderQuickRank() {
  const container = $("quick-rank");
  container.innerHTML = "";

  if (wallet.userCards.length < 2) {
    container.innerHTML = `<p class="hint">Add 2+ cards to see comparisons.</p>`;
    return;
  }

  const categories = ["dining", "grocery", "travel", "gas", "streaming", "general"];

  categories.forEach((cat) => {
    const results = rankCards(wallet.userCards, cat, wallet.pointValues);
    if (results.length === 0) return;

    const top = results[0];
    const el = document.createElement("div");
    el.className = "rank-row";

    const rateDisplay = `${top.effectiveRate.toFixed(1)}\u00a2/$`;

    el.innerHTML = `
      <span class="rank-category">${cat}</span>
      <span class="rank-card">${top.cardName}</span>
      <span class="rank-rate">${rateDisplay}</span>
    `;
    container.appendChild(el);
  });
}

function render() {
  renderWalletCards();
  renderQuickRank();
}

// ── Init ──

async function init() {
  await loadWallet();
  render();

  const searchInput = $("card-search") as HTMLInputElement;
  searchInput.addEventListener("input", () => renderSearch(searchInput.value));

  // Mark onboarding as complete once popup is opened
  if (!wallet.onboardingComplete) {
    chrome.runtime.sendMessage({ type: "SET_ONBOARDING_COMPLETE" });
  }
}

document.addEventListener("DOMContentLoaded", init);
