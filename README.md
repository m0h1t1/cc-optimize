# Swipe

**Stop leaving money on the table every time you check out.**

Swipe is a Chrome extension that tells you which credit card to use at checkout so you always earn the most rewards. No spreadsheets, no guessing — just open the popup and it shows you the best card for where you're shopping.

---

## How It Works

1. **Add your cards** — Search and add the credit cards you carry (we support 20+ popular cards across Amex, Chase, Citi, Capital One, Discover, and more).
2. **Shop like normal** — Swipe detects when you're on a checkout page and automatically identifies the merchant category (dining, grocery, travel, gas, streaming, etc.).
3. **Use the best card** — A recommendation pops up showing which card earns you the most, ranked by effective rewards rate in cents per dollar.

Swipe handles the math behind category bonuses, rotating quarterly categories, point valuations, and cashback rates so you don't have to.

## Features

- **Smart checkout detection** — Recognizes checkout pages across 100+ merchants
- **Real-time card ranking** — Compares your cards by effective value, not just the multiplier on the back of the card
- **Rotating bonus tracking** — Knows when your Discover or Chase Freedom 5% categories are active
- **Guided onboarding** — Walks you through adding your first cards when you install
- **Lightweight** — No account needed, no data sent anywhere. Everything stays in your browser.

## Getting Started

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Or watch for changes during development
npm run watch
```

Then load it in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this project folder
4. Pin Swipe to your toolbar for quick access

## Supported Cards

Amex Gold, Amex Platinum, Chase Sapphire Preferred, Chase Sapphire Reserve, Chase Freedom Flex, Chase Freedom Unlimited, Citi Double Cash, Citi Custom Cash, Capital One Savor, Capital One Venture X, Capital One Quicksilver, Discover it Cash Back, Apple Card, Amazon Prime Visa, and more.

## Project Structure

```
src/
  background.ts    # Service worker — manages card storage
  content.ts       # Content script — checkout detection and recommendation banner
  popup.ts         # Extension popup UI
  rank.ts          # Card ranking engine
  cards.ts         # Card database with rates and bonuses
  categories.ts    # Merchant-to-category mapping
  detect.ts        # Checkout page and card network detection
  types.ts         # TypeScript interfaces
popup.html         # Popup markup and styles
manifest.json      # Chrome extension manifest (MV3)
```

## Tech Stack

- TypeScript
- esbuild
- Chrome Extensions Manifest V3
- Chrome Storage API
