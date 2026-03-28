import type { Network } from "./types";

// --- Negative signals: domains/patterns that are definitely NOT shopping ---
const NON_SHOPPING_DOMAINS = [
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "stackoverflow.com",
  "stackexchange.com",
  "developer.mozilla.org",
  "docs.google.com",
  "drive.google.com",
  "notion.so",
  "figma.com",
  "wikipedia.org",
  "reddit.com",
  "youtube.com",
  "twitch.tv",
  "discord.com",
  "slack.com",
  "linkedin.com",
  "medium.com",
  "dev.to",
  "npmjs.com",
  "pypi.org",
  "crates.io",
  "hub.docker.com",
  "readthedocs.io",
  "jira.atlassian.com",
  "confluence.atlassian.com",
  "localhost",
];

function isNonShoppingSite(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return NON_SHOPPING_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith("." + d)
  );
}

// --- Strong URL patterns (high confidence — checkout/payment specific) ---
const STRONG_URL_PATTERNS = [
  /\/checkout/i,
  /\/payment\b/i,
  /\/pay\b/i,
  /\/gp\/buy/i,
  /\/place-order/i,
  /\/secure\/checkout/i,
];

// --- Weak URL patterns (ambiguous — need DOM confirmation) ---
const WEAK_URL_PATTERNS = [
  /\/order\b/i,
  /\/purchase\b/i,
  /\/billing\b/i,
  /\/cart\b/i,
  /\/bag\b/i,
  /\/basket\b/i,
];

// --- DOM: payment field categories for combination matching ---
const CARD_NUMBER_KEYWORDS = [
  "card number",
  "credit card",
  "debit card",
  "card-number",
  "cardnumber",
  "cc-number",
  "cc-num",
];

const EXPIRY_KEYWORDS = [
  "expiration date",
  "expiry date",
  "exp date",
  "exp-date",
  "mm/yy",
  "mm / yy",
  "card-expiry",
  "cc-exp",
];

const CVV_KEYWORDS = [
  "cvv",
  "cvc",
  "security code",
  "card verification",
  "csv",
  "cc-csc",
];

const PAYMENT_METHOD_KEYWORDS = [
  "payment method",
  "pay with",
  "billing address",
  "shipping address",
  "order total",
  "order summary",
  "place order",
  "complete purchase",
  "submit payment",
  "add to cart",
];

/** Gather all visible text signals from an element. */
function getElementText(el: Element): string {
  return [
    el.getAttribute("placeholder"),
    el.getAttribute("aria-label"),
    el.getAttribute("name"),
    el.getAttribute("id"),
    el.getAttribute("data-testid"),
    el.getAttribute("autocomplete"),
    el.tagName === "LABEL" || el.tagName === "SPAN" || el.tagName === "P"
      ? el.textContent
      : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

interface DomSignals {
  hasCardNumber: boolean;
  hasExpiry: boolean;
  hasCVV: boolean;
  paymentKeywordCount: number;
}

function scanDomSignals(): DomSignals {
  const elements = Array.from(
    document.querySelectorAll(
      'input, label, select, [data-testid], [aria-label], button, span, [role="heading"]'
    )
  );

  let hasCardNumber = false;
  let hasExpiry = false;
  let hasCVV = false;
  let paymentKeywordCount = 0;

  for (const el of elements) {
    const text = getElementText(el);
    if (!text) continue;

    if (!hasCardNumber && CARD_NUMBER_KEYWORDS.some((kw) => text.includes(kw))) {
      hasCardNumber = true;
    }
    if (!hasExpiry && EXPIRY_KEYWORDS.some((kw) => text.includes(kw))) {
      hasExpiry = true;
    }
    if (!hasCVV && CVV_KEYWORDS.some((kw) => text.includes(kw))) {
      hasCVV = true;
    }
    if (PAYMENT_METHOD_KEYWORDS.some((kw) => text.includes(kw))) {
      paymentKeywordCount++;
    }
  }

  // Also check for Stripe/Braintree/Square iframes (common payment processors)
  const iframes = Array.from(document.querySelectorAll("iframe"));
  for (const iframe of iframes) {
    const src = (iframe.src || "").toLowerCase();
    const name = (iframe.name || "").toLowerCase();
    const title = (iframe.title || "").toLowerCase();
    if (
      src.includes("stripe.com") ||
      src.includes("braintree") ||
      src.includes("square") ||
      src.includes("adyen") ||
      src.includes("paypal") ||
      name.includes("card-number") ||
      name.includes("__privateStripeFrame") ||
      title.includes("card number") ||
      title.includes("payment")
    ) {
      hasCardNumber = true;
    }
  }

  return { hasCardNumber, hasExpiry, hasCVV, paymentKeywordCount };
}

/**
 * Determines if the current page is a checkout/payment page.
 *
 * Strategy:
 *  1. Bail immediately on known non-shopping domains.
 *  2. Strong URL match (e.g. /checkout, /payment) + at least one DOM signal = checkout.
 *  3. Weak URL match (e.g. /cart, /order) requires strong DOM evidence (payment form fields).
 *  4. No URL match — only trigger if the DOM has a full payment form (card + expiry + CVV)
 *     OR a payment processor iframe.
 */
export function detectCheckout(): boolean {
  // 1. Early exit for non-shopping sites
  if (isNonShoppingSite()) return false;

  const url = window.location.href;
  const strongUrlMatch = STRONG_URL_PATTERNS.some((p) => p.test(url));
  const weakUrlMatch = WEAK_URL_PATTERNS.some((p) => p.test(url));

  const dom = scanDomSignals();

  const hasPaymentForm =
    (dom.hasCardNumber && dom.hasExpiry) ||
    (dom.hasCardNumber && dom.hasCVV) ||
    (dom.hasExpiry && dom.hasCVV);

  const hasAnyDomSignal =
    dom.hasCardNumber ||
    dom.hasExpiry ||
    dom.hasCVV ||
    dom.paymentKeywordCount >= 2;

  // 2. Strong URL + any DOM signal
  if (strongUrlMatch && hasAnyDomSignal) return true;

  // 3. Weak URL + strong DOM evidence (actual payment fields)
  if (weakUrlMatch && hasPaymentForm) return true;

  // 4. No URL match — only if there's a clear payment form
  if (hasPaymentForm && dom.paymentKeywordCount >= 1) return true;

  return false;
}

const NETWORK_PREFIXES: { prefix: RegExp; network: Network }[] = [
  { prefix: /^3[47]/, network: "AMEX" },
  { prefix: /^4/, network: "VISA" },
  { prefix: /^5[1-5]/, network: "MASTERCARD" },
  { prefix: /^6(?:011|5)/, network: "DISCOVER" },
];

export function detectNetwork(digits: string): Network | null {
  const cleaned = digits.replace(/\s|-/g, "");
  if (cleaned.length < 2) return null;

  for (const { prefix, network } of NETWORK_PREFIXES) {
    if (prefix.test(cleaned)) return network;
  }
  return null;
}

export function observeCardInput(
  callback: (network: Network) => void
): MutationObserver {
  function checkInputs() {
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[type="tel"], input:not([type])'
    ));

    for (const input of inputs) {
      if (input.dataset.swipeListening) continue;
      input.dataset.swipeListening = "true";

      input.addEventListener("input", () => {
        const val = input.value.replace(/\s|-/g, "");
        if (val.length >= 4 && val.length <= 6) {
          const network = detectNetwork(val);
          if (network) callback(network);
        }
      });
    }
  }

  checkInputs();

  const observer = new MutationObserver(() => checkInputs());
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}
