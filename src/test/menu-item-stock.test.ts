import { describe, expect, it } from "vitest";
import { menuItemStock } from "@/lib/calc";
const m = { id: "A", type: "In-house", batchUnit: "pc" } as const;
const db = (b: number, s: number, w: number) => ({ batches: [{ menuItemId: "A", producedAt: "2026-11-20T08:00:00Z", quantity: b }], sales: [{ menuItemId: "A", date: "2026-11-21", quantity: s }], wasteLogs: [{ stage: "Finished Product", menuItemId: "A", unit: "pc", at: "2026-11-21T10:00:00Z", quantity: w }] }) as never;
describe("menuItemStock", () => {
  it("is produced minus sold minus wasted", () => expect(menuItemStock(db(12, 5, 2), m, "2026-11-27")).toBe(5));
  it("never goes below zero", () => expect(menuItemStock(db(4, 5, 2), m, "2026-11-27")).toBe(0));
  it("is null for made-to-order", () => expect(menuItemStock(db(4, 1, 0), { ...m, type: "Made-to-order" }, "2026-11-27")).toBeNull());
});
