import { detectCheckout, detectNetwork, observeCardInput } from "./detect";
import { getMerchantCategory } from "./categories";
import { rankCards } from "./rank";
import type { Network, RankResult, UserStorage } from "./types";

const BANNER_ID = "mopay-recommendation-banner";

function createBanner(): HTMLDivElement {
  const existing = document.getElementById(BANNER_ID);
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = BANNER_ID;
  banner.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 340px;
    max-height: 400px;
    background: #1a1a2e;
    color: #eee;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    overflow: hidden;
    transition: opacity 0.2s;
  `;
  document.body.appendChild(banner);
  return banner;
}

function renderRecommendation(results: RankResult[], category: string, cardCount: number, allCardsAdded: boolean) {
  const banner = createBanner();

  const header = document.createElement("div");
  header.style.cssText = `
    padding: 14px 16px;
    background: #16213e;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  `;
  header.innerHTML = `
    <div>
      <div style="font-weight:700;font-size:15px;color:#fff;">MoPay</div>
      <div style="font-size:11px;color:#8892b0;margin-top:2px;">Best card for <strong style="color:#64ffda">${category}</strong></div>
    </div>
  `;
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u00d7";
  closeBtn.style.cssText = `
    background:none;border:none;color:#8892b0;font-size:22px;cursor:pointer;
    padding:0 4px;line-height:1;
  `;
  closeBtn.onclick = () => banner.remove();
  header.appendChild(closeBtn);
  banner.appendChild(header);

  const list = document.createElement("div");
  list.style.cssText = "padding: 8px 0; max-height: 280px; overflow-y: auto;";

  results.forEach((r, i) => {
    const item = document.createElement("div");
    const isTop = i === 0;
    item.style.cssText = `
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      ${isTop ? "background: rgba(100,255,218,0.08);" : ""}
      ${i < results.length - 1 ? "border-bottom: 1px solid rgba(255,255,255,0.05);" : ""}
    `;

    const rateDisplay = r.rewardType === "cashback"
      ? `${r.effectiveRate.toFixed(1)}\u00a2/\u0024`
      : `${r.effectiveRate.toFixed(1)}\u00a2/\u0024`;

    item.innerHTML = `
      <div>
        <div style="font-weight:${isTop ? "700" : "500"};color:${isTop ? "#64ffda" : "#ccd6f6"};font-size:${isTop ? "14px" : "13px"};">
          ${isTop ? "\u2b50 " : ""}${r.cardName}
        </div>
        <div style="font-size:11px;color:#8892b0;margin-top:2px;">${r.reason}</div>
      </div>
      <div style="font-weight:700;color:${isTop ? "#64ffda" : "#a8b2d1"};font-size:${isTop ? "16px" : "13px"};white-space:nowrap;margin-left:12px;">
        ${rateDisplay}
      </div>
    `;
    list.appendChild(item);
  });

  banner.appendChild(list);

  // FOMO nudge for users with few cards
  if (cardCount <= 3 && !allCardsAdded) {
    const nudge = document.createElement("div");
    nudge.style.cssText = `
      padding: 10px 16px;
      border-top: 1px solid rgba(255,255,255,0.08);
      text-align: center;
      font-size: 11px;
      color: #8892b0;
    `;
    const cardWord = cardCount === 1 ? "card" : "cards";
    nudge.innerHTML = `Only comparing <strong style="color:#64ffda">${cardCount}</strong> ${cardWord} — <span style="color:#64ffda;cursor:pointer;">add more</span> for better recommendations`;
    banner.appendChild(nudge);
  }
}

function renderOnboarding() {
  const banner = createBanner();
  banner.innerHTML = `
    <div style="padding:20px;text-align:center;">
      <div style="font-size:24px;margin-bottom:8px;">💳</div>
      <div style="font-weight:700;font-size:16px;color:#fff;margin-bottom:6px;">MoPay</div>
      <div style="color:#8892b0;font-size:13px;margin-bottom:14px;">
        Add your cards to get personalized recommendations at checkout.
      </div>
      <div style="font-size:12px;color:#64ffda;">Click the MoPay icon in your toolbar to get started.</div>
    </div>
  `;
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u00d7";
  closeBtn.style.cssText = `
    position:absolute;top:8px;right:10px;background:none;border:none;color:#8892b0;
    font-size:20px;cursor:pointer;
  `;
  closeBtn.onclick = () => banner.remove();
  banner.style.position = "fixed";
  banner.appendChild(closeBtn);
}

function renderNetworkPrompt(network: Network) {
  const banner = createBanner();
  banner.innerHTML = `
    <div style="padding:16px;text-align:center;">
      <div style="font-size:13px;color:#8892b0;margin-bottom:6px;">MoPay detected a card</div>
      <div style="font-weight:700;font-size:15px;color:#fff;margin-bottom:12px;">
        Looks like a <span style="color:#64ffda">${network}</span> card
      </div>
      <div style="font-size:12px;color:#8892b0;">
        Want to add it? Click the MoPay icon in your toolbar.
      </div>
    </div>
  `;
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u00d7";
  closeBtn.style.cssText = `
    position:absolute;top:8px;right:10px;background:none;border:none;color:#8892b0;
    font-size:20px;cursor:pointer;
  `;
  closeBtn.onclick = () => banner.remove();
  banner.appendChild(closeBtn);
}

async function init() {
  // Wait a moment for page to render
  await new Promise((r) => setTimeout(r, 1000));

  if (!detectCheckout()) return;

  const domain = window.location.hostname;
  const category = getMerchantCategory(domain);

  const wallet: UserStorage = await chrome.runtime.sendMessage({ type: "GET_WALLET" });

  if (!wallet.userCards.length) {
    if (!wallet.onboardingComplete) {
      renderOnboarding();
    }
    return;
  }

  const results = rankCards(wallet.userCards, category, wallet.pointValues);

  if (results.length > 0) {
    renderRecommendation(results, category, wallet.userCards.length, wallet.allCardsAdded);
  }

  // Watch for card input to detect network
  observeCardInput((network: Network) => {
    const hasNetwork = wallet.userCards.some((id) => {
      const card = results.find((r) => r.cardId === id);
      return card?.network === network;
    });

    if (!hasNetwork) {
      renderNetworkPrompt(network);
    }
  });
}

init();
