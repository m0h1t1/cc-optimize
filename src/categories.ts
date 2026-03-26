import categoryMap from "../data/categories.json";

const CATEGORY_MAP: Record<string, string> = categoryMap;

export function getMerchantCategory(hostname: string): string {
  const domain = hostname.replace(/^www\./, "").toLowerCase();

  if (CATEGORY_MAP[domain]) {
    return CATEGORY_MAP[domain];
  }

  // Check partial matches (e.g., "amazon.com/fresh" won't match here,
  // but "something.amazon.com" should match "amazon.com")
  for (const [key, category] of Object.entries(CATEGORY_MAP)) {
    if (key !== "_default" && domain.endsWith(key)) {
      return category;
    }
  }

  return CATEGORY_MAP["_default"] || "general";
}
