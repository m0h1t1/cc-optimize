import { detectCheckout, detectNetwork, observeCardInput } from "./detect";
import { getMerchantCategories } from "./categories";
import { rankCards } from "./rank";
import type { Network, RankResult, UserStorage } from "./types";

const BANNER_ID = "mopay-recommendation-banner";

function dismissBanner(banner: HTMLElement, toastMessage?: string) {
  banner.style.opacity = "0";
  banner.style.transform = "translateY(10px)";
  banner.style.transition = "opacity 0.25s ease, transform 0.25s ease";

  setTimeout(() => {
    banner.remove();

    if (toastMessage) {
      const toast = document.createElement("div");
      toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
        background: #1a1a2e; color: #8892b0; padding: 10px 16px;
        border-radius: 8px; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        opacity: 0; transition: opacity 0.3s ease;
      `;
      toast.textContent = toastMessage;
      document.body.appendChild(toast);
      requestAnimationFrame(() => { toast.style.opacity = "1"; });
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 2500);
    }
  }, 250);
}

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
    transition: opacity 0.25s ease, transform 0.25s ease;
    transform: translateY(0);
  `;
  document.body.appendChild(banner);
  return banner;
}

function renderRecommendation(results: RankResult[], categories: string[], cardCount: number, allCardsAdded: boolean) {
  const banner = createBanner();

  // Extract the matched category from the top card's reason (e.g., "4x on dining" → "dining")
  const topReason = results[0]?.reason || "";
  const reasonMatch = topReason.match(/on\s+(.+?)(?:\s*\(|$)/);
  const bestCategory = reasonMatch?.[1] === "all purchases"
    ? categories[0]
    : (reasonMatch?.[1] || categories[0]);

  const header = document.createElement("div");
  header.style.cssText = `
    padding: 14px 16px;
    background: #16213e;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  `;
  const headerLeft = document.createElement("div");
  headerLeft.innerHTML = `
    <div style="font-weight:700;font-size:15px;color:#fff;">MoPay</div>
    <div style="font-size:11px;color:#8892b0;margin-top:2px;">
      Best card for <strong style="color:#64ffda">${bestCategory}</strong>
      <span class="mopay-wrong-cat" style="color:#555e70;cursor:pointer;margin-left:4px;font-size:10px;">wrong?</span>
    </div>
  `;
  header.appendChild(headerLeft);

  // "Wrong category?" handler
  const wrongLink = headerLeft.querySelector(".mopay-wrong-cat");
  if (wrongLink) {
    wrongLink.addEventListener("click", (e) => {
      e.stopPropagation();
      const existing = banner.querySelector(".mopay-cat-picker");
      if (existing) { existing.remove(); return; }

      const picker = document.createElement("div");
      picker.className = "mopay-cat-picker";
      picker.style.cssText = `
        padding: 8px 16px; background: #16213e;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        display: flex; align-items: center; gap: 8px;
        font-size: 12px; color: #8892b0;
      `;
      const label = document.createElement("span");
      label.textContent = "Category:";
      const select = document.createElement("select");
      select.style.cssText = `
        background: #1a1a2e; color: #64ffda; border: 1px solid rgba(100,255,218,0.3);
        border-radius: 4px; padding: 3px 6px; font-size: 11px; cursor: pointer;
        outline: none;
      `;
      for (const cat of AVAILABLE_CATEGORIES) {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat.replace(/_/g, " ");
        if (cat === bestCategory) opt.selected = true;
        select.appendChild(opt);
      }
      select.onchange = () => {
        const domain = window.location.hostname;
        const newCats = [select.value];
        chrome.runtime.sendMessage({ type: "SET_SITE_CATEGORY", domain, categories: newCats });
        // Re-render with new category
        showBanner();
      };
      picker.appendChild(label);
      picker.appendChild(select);
      // Insert after header
      header.after(picker);
    });
  }
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u00d7";
  closeBtn.style.cssText = `
    background:none;border:none;color:#8892b0;font-size:22px;cursor:pointer;
    padding:0 4px;line-height:1;
  `;
  closeBtn.onclick = () => dismissBanner(banner);
  header.appendChild(closeBtn);
  banner.appendChild(header);

  // "Don't show on this site" footer
  const hideFooter = document.createElement("div");
  hideFooter.style.cssText = `
    padding: 8px 16px;
    border-top: 1px solid rgba(255,255,255,0.08);
    text-align: center;
  `;
  const hideBtn = document.createElement("button");
  hideBtn.textContent = "Don\u2019t show on this site";
  hideBtn.style.cssText = `
    background: none; border: none; color: #555e70; font-size: 11px;
    cursor: pointer; padding: 2px 0;
  `;
  hideBtn.onmouseenter = () => { hideBtn.style.color = "#8892b0"; };
  hideBtn.onmouseleave = () => { hideBtn.style.color = "#555e70"; };
  hideBtn.onclick = () => {
    const domain = window.location.hostname;
    chrome.runtime.sendMessage({ type: "HIDE_SITE", domain });
    dismissBanner(banner, "Hidden — click MoPay icon to re-enable");
  };
  hideFooter.appendChild(hideBtn);

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
    nudge.innerHTML = `Only comparing <strong style="color:#64ffda">${cardCount}</strong> ${cardWord} — <span class="mopay-add-more" style="color:#64ffda;cursor:pointer;">add more</span> for better recommendations`;
    const addMoreLink = nudge.querySelector(".mopay-add-more");
    if (addMoreLink) {
      addMoreLink.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
      });
    }
    banner.appendChild(nudge);
  }

  banner.appendChild(hideFooter);
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

const AVAILABLE_CATEGORIES = [
  "dining", "grocery", "travel", "flights", "hotels", "streaming",
  "entertainment", "gas", "transit", "drugstore", "home_improvement",
  "fitness", "amazon", "apple", "paypal", "general"
];

async function showBanner() {
  const domain = window.location.hostname;
  const wallet: UserStorage = await chrome.runtime.sendMessage({ type: "GET_WALLET" });

  // Use user-set category if available, otherwise detect from domain
  const userCategories = wallet.siteCategories?.[domain];
  const categories = userCategories || getMerchantCategories(domain);

  if (!wallet.userCards.length) {
    if (!wallet.onboardingComplete) {
      renderOnboarding();
    }
    return;
  }

  const results = rankCards(wallet.userCards, categories, wallet.pointValues);

  if (results.length > 0) {
    renderRecommendation(results, categories, wallet.userCards.length, wallet.allCardsAdded);
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

async function init() {
  // Wait a moment for page to render
  await new Promise((r) => setTimeout(r, 1000));

  if (!detectCheckout()) return;

  const domain = window.location.hostname;

  // Check if user has hidden this site
  const wallet: UserStorage = await chrome.runtime.sendMessage({ type: "GET_WALLET" });
  const hiddenSites = wallet.hiddenSites || [];
  if (hiddenSites.includes(domain)) return;

  showBanner();
}

// Listen for popup open — unhide the current site and show the banner
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "POPUP_OPENED") {
    const domain = window.location.hostname;
    chrome.runtime.sendMessage({ type: "UNHIDE_SITE", domain });
    // Re-show banner if on a checkout page
    if (detectCheckout()) {
      const existing = document.getElementById(BANNER_ID);
      if (!existing) showBanner();
    }
  }
});

init();
