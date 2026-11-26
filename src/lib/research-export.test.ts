import { describe, expect, it } from "vitest";
import { buildResearchExport, toCsv } from "./research-export";

const base = { ingredients: [{ id: "i1", name: "Secret Milk", category: "Dairy", storage: "Chiller", unit: "ml", unitCost: 9 }] as never,
  menuItems: [{ id: "m1", name: "Secret Croissant", category: "Pastry", retailPrice: 120, tags: [], type: "In-house" }] as never,
  sales: [{ id: "s1", menuItemId: "m1", date: "2026-11-23", quantity: 5, unitPrice: 120, notes: "vip Maria" }] as never,
  batches: [], purchases: [], usages: [], dailyChecks: [],
  wasteLogs: [{ id: "w1", at: "2026-11-23T10:00:00Z", stage: "Display", menuItemId: "m1", wasteType: "Unsold", quantity: 2, unit: "pcs", unitCost: 40, value: 80 }] as never };

describe("research export", () => {
  it("never writes names, prices, costs or notes", () => {
    const all = buildResearchExport(base).map((f) => f.content).join("\n");
    for (const secret of ["Secret", "120", "Maria", "80"]) expect(all).not.toContain(secret);
  });
  it("uses the same item token across sales and waste", () => {
    const files = Object.fromEntries(buildResearchExport(base).map((f) => [f.name, f.content]));
    expect(files["sales.csv"]).toContain("ITEM-001,Pastry,5");
    expect(files["waste_logs.csv"]).toContain("menu_item,ITEM-001,Pastry,,2,pcs");
    expect(files["weekly_summary.csv"]).toContain("2026-11-23,1,5,0,1,2 pcs");
  });
  it("quotes commas in CSV cells", () => {
    expect(toCsv(["a"], [["x,y"]])).toBe('a\r\n"x,y"\r\n');
  });
});
