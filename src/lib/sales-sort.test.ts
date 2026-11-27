import { describe, expect, it } from "vitest";
import { sortSales } from "./sales-sort";

const r = (date: string, name: string, quantity: number, unitPrice: number) => ({ date, name, quantity, unitPrice, revenue: quantity * unitPrice });
const rows = [r("2026-11-25", "croissant", 2, 85), r("2026-11-27", "Americano", 31, 95), r("2026-11-26", "Americano", 3, 95)];

describe("sortSales", () => {
  it("revenue high to low", () => expect(sortSales(rows, "rev-desc").map((x) => x.revenue)).toEqual([2945, 285, 170]));
  it("name A to Z, case-insensitive, ties newest first", () =>
    expect(sortSales(rows, "name-asc").map((x) => `${x.name}:${x.date}`)).toEqual(["Americano:2026-11-27", "Americano:2026-11-26", "croissant:2026-11-25"]));
  it("oldest first", () => expect(sortSales(rows, "date-asc")[0].date).toBe("2026-11-25"));
});
