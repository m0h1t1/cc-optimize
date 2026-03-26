export interface Card {
  id: string;
  name: string;
  network: "VISA" | "MASTERCARD" | "AMEX" | "DISCOVER";
  reward_type: "points" | "cashback" | "miles";
  point_value_cpp: number;
  base_rate: number;
  category_rates: Record<string, number>;
}

export interface RotatingBonus {
  Q1?: string[];
  Q2?: string[];
  Q3?: string[];
  Q4?: string[];
}

export interface CategoryRate {
  category: string;
  rate: number;
  isRotating: boolean;
}

export interface RankResult {
  cardId: string;
  cardName: string;
  network: string;
  effectiveRate: number;
  rate: number;
  reason: string;
  rewardType: string;
}

export type Network = "VISA" | "MASTERCARD" | "AMEX" | "DISCOVER";

export interface UserStorage {
  userCards: string[];
  pointValues: Record<string, number>;
  onboardingComplete: boolean;
}

export interface CheckoutInfo {
  isCheckout: boolean;
  domain: string;
  category: string;
}
