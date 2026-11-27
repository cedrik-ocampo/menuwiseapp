import { describe, expect, it } from "vitest";
import { filterBatches, sortBatches } from "@/lib/production-sort";

const rows = [
  { id: "a", menuItemId: "m1", quantity: 10, producedAt: "2026-11-25T08:00", expiryDate: "2026-11-27" },
  { id: "b", menuItemId: "m2", quantity: 30, producedAt: "2026-11-27T08:00", expiryDate: "2026-11-29" },
  { id: "c", menuItemId: "m1", quantity: 20, producedAt: "2026-11-26T08:00", expiryDate: "2026-11-26" },
  { id: "d", menuItemId: "m2", quantity: 5, producedAt: "2026-11-24T08:00", expiryDate: "" },
];
const names: Record<string, string> = { m1: "Croissant", m2: "brownie" };
const ids = (r: { id: string }[]) => r.map((x) => x.id);
const nameOf = (b: { menuItemId: string }) => names[b.menuItemId]!;

describe("sortBatches", () => {
  it("newest first by default", () => expect(ids(sortBatches(rows, "date-desc", nameOf))).toEqual(["b", "c", "a", "d"]));
  it("oldest first", () => expect(ids(sortBatches(rows, "date-asc", nameOf))).toEqual(["d", "a", "c", "b"]));
  it("item A to Z, case-insensitive, ties newest first", () => expect(ids(sortBatches(rows, "name-asc", nameOf))).toEqual(["b", "d", "c", "a"]));
  it("quantity high to low", () => expect(ids(sortBatches(rows, "qty-desc", nameOf))).toEqual(["b", "c", "a", "d"]));
  it("expiry soonest first, no-expiry last", () => expect(ids(sortBatches(rows, "exp-asc", nameOf))).toEqual(["c", "a", "b", "d"]));
  it("expiry latest first, no-expiry last", () => expect(ids(sortBatches(rows, "exp-desc", nameOf))).toEqual(["b", "a", "c", "d"]));
});

describe("filterBatches", () => {
  const today = "2026-11-27";
  it("filters by item", () => expect(ids(filterBatches(rows, "m1", "all", today))).toEqual(["a", "c"]));
  it("expiring today", () => expect(ids(filterBatches(rows, "all", "today", today))).toEqual(["a"]));
  it("expired", () => expect(ids(filterBatches(rows, "all", "expired", today))).toEqual(["c"]));
  it("not expired includes no-expiry", () => expect(ids(filterBatches(rows, "all", "fresh", today))).toEqual(["b", "d"]));
});
