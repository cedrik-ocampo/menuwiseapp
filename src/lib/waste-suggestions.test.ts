import { describe, expect, it } from "vitest";
import { resolveWasteName, wasteSuggestions } from "./waste-suggestions";
import type { WasteLog } from "./types";

const db = {
  ingredients: [{ id: "milk", name: "Milk", category: "", storage: "", unit: "L", unitCost: 80 }],
  menuItems: [{ id: "latte", name: "Latte" } as any],
  wasteLogs: [
    { id: "a", at: "2026-11-01T08:00:00Z", stage: "Finished Product", customName: "Ube Cake", unit: "slice", unitCost: 40 } as WasteLog,
    { id: "b", at: "2026-11-02T08:00:00Z", stage: "Finished Product", customName: "ube  cake ", unit: "slice", unitCost: 45 } as WasteLog,
  ],
};

describe("waste suggestions", () => {
  it("lists a previously typed name once with its latest cost", () => {
    const s = wasteSuggestions(db, "Finished Product").filter((x) => x.kind === "Previously logged");
    expect(s).toHaveLength(1);
    expect(s[0].unitCost).toBe(45);
  });
  it("matches names ignoring capitals and extra spaces", () => {
    expect(resolveWasteName("  UBE cake", wasteSuggestions(db, "Finished Product"))?.kind).toBe("Previously logged");
    expect(resolveWasteName("latte", wasteSuggestions(db, "Finished Product"))?.id).toBe("latte");
  });
  it("only suggests ingredients for the Ingredient stage", () => {
    expect(wasteSuggestions(db, "Ingredient").map((x) => x.name)).toEqual(["Milk"]);
  });
});
