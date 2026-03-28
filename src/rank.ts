import type { Card, RankResult, RotatingBonus } from "./types";
import cardsData from "../data/cards.json";
import rotatingData from "../data/rotating.json";

const CARDS_DB: Card[] = cardsData as Card[];
const ROTATING_DB: Record<string, RotatingBonus> = rotatingData;

const ROTATING_BONUS_RATE = 5;

function getCurrentQuarter(): "Q1" | "Q2" | "Q3" | "Q4" {
  const month = new Date().getMonth();
  if (month < 3) return "Q1";
  if (month < 6) return "Q2";
  if (month < 9) return "Q3";
  return "Q4";
}

export function getCardById(id: string): Card | undefined {
  return CARDS_DB.find((c) => c.id === id);
}

export function getAllCards(): Card[] {
  return CARDS_DB;
}

function getEffectiveRateForCategory(
  card: Card,
  category: string
): { rate: number; isRotating: boolean; category: string } {
  const quarter = getCurrentQuarter();
  const rotating = ROTATING_DB[card.id];

  if (rotating?.[quarter]?.includes(category)) {
    return { rate: ROTATING_BONUS_RATE, isRotating: true, category };
  }

  const rate = card.category_rates[category] ?? card.base_rate;
  return { rate, isRotating: false, category };
}

function getBestRate(
  card: Card,
  categories: string[]
): { rate: number; isRotating: boolean; category: string } {
  let best = { rate: card.base_rate, isRotating: false, category: "general" };

  for (const cat of categories) {
    const result = getEffectiveRateForCategory(card, cat);
    if (result.rate > best.rate) {
      best = result;
    }
  }

  return best;
}

export function buildReason(
  card: Card,
  rate: number,
  category: string,
  isRotating: boolean
): string {
  const unit = card.reward_type === "cashback" ? "%" : "x";
  const rotatingTag = isRotating ? " (rotating bonus)" : "";

  if (rate === card.base_rate && !isRotating) {
    return `${rate}${unit} on all purchases`;
  }
  return `${rate}${unit} on ${category}${rotatingTag}`;
}

export function rankCards(
  userCardIds: string[],
  categories: string[],
  cppOverrides: Record<string, number> = {}
): RankResult[] {
  const results: RankResult[] = [];

  for (const cardId of userCardIds) {
    const card = getCardById(cardId);
    if (!card) continue;

    const cpp = cppOverrides[cardId] ?? card.point_value_cpp;
    const { rate, isRotating, category } = getBestRate(card, categories);
    const effectiveRate = rate * cpp;

    results.push({
      cardId: card.id,
      cardName: card.name,
      network: card.network,
      effectiveRate,
      rate,
      reason: buildReason(card, rate, category, isRotating),
      rewardType: card.reward_type,
    });
  }

  return results.sort((a, b) => b.effectiveRate - a.effectiveRate);
}
