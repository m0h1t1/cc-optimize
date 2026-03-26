import type { Network } from "./types";

const CHECKOUT_URL_PATTERNS = [
  /\/checkout/i,
  /\/payment/i,
  /\/order/i,
  /\/pay\b/i,
  /\/purchase/i,
  /\/billing/i,
  /\/cart/i,
];

const PAYMENT_FORM_KEYWORDS = [
  "card number",
  "credit card",
  "debit card",
  "card-number",
  "cardnumber",
  "cc-number",
  "payment method",
  "expiration date",
  "exp date",
  "cvv",
  "cvc",
  "security code",
];

export function detectCheckout(): boolean {
  const urlMatch = CHECKOUT_URL_PATTERNS.some((p) => p.test(window.location.href));

  const inputs = Array.from(document.querySelectorAll('input, label, [data-testid], [aria-label]'));
  let domMatch = false;
  for (const el of inputs) {
    const text = (
      el.getAttribute("placeholder") ||
      el.getAttribute("aria-label") ||
      el.getAttribute("name") ||
      el.getAttribute("data-testid") ||
      el.textContent ||
      ""
    ).toLowerCase();

    if (PAYMENT_FORM_KEYWORDS.some((kw) => text.includes(kw))) {
      domMatch = true;
      break;
    }
  }

  return urlMatch || domMatch;
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
      if (input.dataset.mopayListening) continue;
      input.dataset.mopayListening = "true";

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
