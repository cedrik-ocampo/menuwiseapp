/** Pure menu-engineering classification with actions. Values are per item for the chosen window. */
import { median, type Confidence, type SuggestionSettings } from "./reorder";

export type MEQuadrant = "Star" | "Plowhorse" | "Puzzle" | "Dog";
export interface MEItem {
  id: string;
  name: string;
  category: string;
  price: number;
  unitCost: number;
  /** Peso value of waste attributed to this item in the window. */
  wasteCost: number;
  unitsSold: number;
  /** Open days the item was listed in the window. */
  openDaysAvailable: number;
  soldOutDays: number;
  daysListed: number;
  /** Perishable ingredient ids in the recipe. */
  perishables: string[];
}
export interface PerishableInfo { id: string; name: string; expiryRatePct: number }

export interface MEResult {
  id: string;
  name: string;
  category: string;
  status: "classified" | "too-new";
  quadrant: MEQuadrant | null;
  popularity: number;
  margin: number;
  popThreshold: number;
  marginThreshold: number;
  scope: "category" | "menu";
  borderline: boolean;
  confidence: Confidence;
  action: string;
  impact: number;
  notes: string[];
}

export const MIN_SALES = 10;

export function popularityOf(i: MEItem) { return i.unitsSold / Math.max(1, i.openDaysAvailable - i.soldOutDays); }
export function marginOf(i: MEItem) { return i.price - i.unitCost - i.wasteCost / Math.max(1, i.unitsSold); }

const ACTIONS: Record<MEQuadrant, string> = {
  Star: "Promote it, protect quality, and never run out.",
  Plowhorse: "Try a small price rise, a portion or cost cut, or a bundle.",
  Puzzle: "Reposition, rename or feature it to lift sales.",
  Dog: "Reformulate or remove it.",
};

export function classifyMenu(items: MEItem[], settings: Pick<SuggestionSettings, "borderlinePct" | "eligibilityDays" | "categoryMin">, perishables: PerishableInfo[] = [], calendarConfirmed = true): MEResult[] {
  const eligible = items.filter((i) => i.daysListed >= settings.eligibilityDays && i.unitsSold >= MIN_SALES);
  const byCat = new Map<string, MEItem[]>();
  eligible.forEach((i) => byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]));
  const thresholds = (scope: MEItem[]) => ({
    pop: 0.7 * (scope.reduce((a, i) => a + popularityOf(i), 0) / Math.max(1, scope.length)),
    margin: median(scope.map(marginOf)),
  });
  const menuT = thresholds(eligible);
  const band = settings.borderlinePct / 100;
  const pInfo = new Map(perishables.map((p) => [p.id, p]));

  const results = items.map((i): MEResult => {
    const popularity = popularityOf(i), margin = marginOf(i);
    const catItems = byCat.get(i.category) ?? [];
    const scope = catItems.length >= settings.categoryMin ? "category" : "menu";
    const t = scope === "category" ? thresholds(catItems) : menuT;
    const base = { id: i.id, name: i.name, category: i.category, popularity, margin, popThreshold: t.pop, marginThreshold: t.margin, scope } as const;
    if (!eligible.includes(i)) {
      return { ...base, status: "too-new", quadrant: null, borderline: false, confidence: "Low", action: "Too new to classify", impact: 0, notes: [`Needs ${settings.eligibilityDays}+ days listed and ${MIN_SALES}+ sales.`] };
    }
    const highPop = popularity >= t.pop, highMargin = margin >= t.margin;
    const quadrant: MEQuadrant = highPop ? (highMargin ? "Star" : "Plowhorse") : highMargin ? "Puzzle" : "Dog";
    const borderline = Math.abs(popularity - t.pop) <= band * Math.abs(t.pop) || Math.abs(margin - t.margin) <= band * Math.abs(t.margin);
    const notes: string[] = [];
    const wasteShare = i.unitsSold * i.price > 0 ? i.wasteCost / (i.unitsSold * i.price) : 0;
    if (quadrant === "Puzzle" && wasteShare > 0.1) notes.push("High waste — this may really be a Dog.");
    if (quadrant === "Star" && wasteShare > 0.1) notes.push("High waste on a Star points to a production problem, not a menu problem.");
    let action = ACTIONS[quadrant];
    if (borderline) { action = quadrant === "Star" ? ACTIONS.Star : "Borderline — keep watching before changing it."; }
    if (quadrant === "Dog" && !borderline) {
      for (const pid of i.perishables) {
        const users = items.filter((o) => o.id !== i.id && o.perishables.includes(pid));
        const p = pInfo.get(pid);
        if (!p) continue;
        if (users.length) notes.push(`Shares ${p.name} with ${users.length} other item${users.length === 1 ? "" : "s"}; removing it may increase their waste.`);
        else notes.push(`Only user of ${p.name}; removing it also stops buying it (${Math.round(p.expiryRatePct)}% of it currently expires).`);
      }
    }
    const days = Math.max(1, i.openDaysAvailable);
    const impact = quadrant === "Plowhorse" ? (t.margin - margin) * i.unitsSold
      : quadrant === "Puzzle" ? (t.pop - popularity) * days * margin
      : quadrant === "Dog" ? (t.margin - margin) * i.unitsSold
      : margin * i.unitsSold * 0.1;
    const confidence: Confidence = !calendarConfirmed ? "Low" : i.daysListed >= 28 ? "High" : "Medium";
    return { ...base, status: "classified", quadrant, borderline, confidence, action, impact: Math.max(0, Math.round(impact * 100) / 100), notes };
  });
  return results.sort((a, b) => b.impact - a.impact);
}
