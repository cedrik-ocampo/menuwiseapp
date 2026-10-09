/** Tailored "what to do" line for an expiring ingredient, matched by name + category. */
const RULES: [RegExp, string][] = [
  [/milk|cream/, "Use up first in lattes, or make yogurt/pudding."],
  [/bread|pastr|croissant|danish|bun|loaf|bakery/, "Use up first, or make bread pudding."],
  [/berr|strawberr|blueberr/, "Use up first in smoothies, or make a berry compote."],
  [/egg/, "Use up first, or make custard/omelets."],
  [/cheese/, "Use up first in sandwiches, or freeze for later."],
  [/vegetable|produce|lettuce|tomato|onion|carrot|spinach/, "Use up first in soups, or blanch and freeze."],
  [/coffee|espresso|matcha|bean/, "Use up first in iced drinks."],
];
export function suggestionFor(i: { name: string; category?: string }): string {
  const name = i.name.toLowerCase();
  const cat = (i.category ?? "").toLowerCase();
  for (const [re, s] of RULES) if (re.test(name)) return s;
  for (const [re, s] of RULES) if (re.test(cat)) return s;
  return "Use up first.";
}
