import { describe, expect, it } from "vitest";
import { sortWaste } from "./waste-sort";

const r = (at: string, name: string, quantity: number, value: number) => ({ at, name, quantity, value });
const rows = [r("2026-11-25", "whole milk", 1500, 142.5), r("2026-11-27", "Croissant", 2, 170), r("2026-11-26", "Croissant", 3, 255)];
const n = (w: { name: string }) => w.name;
const ids = (key: Parameters<typeof sortWaste>[1]) => sortWaste(rows, key, n).map((x) => `${x.name}:${x.at}`);

describe("sortWaste", () => {
  it("newest first by default", () => expect(ids("date-desc")[0]).toBe("Croissant:2026-11-27"));
  it("oldest first", () => expect(ids("date-asc")[0]).toBe("whole milk:2026-11-25"));
  it("item A to Z case-insensitive, ties newest first", () => expect(ids("name-asc")).toEqual(["Croissant:2026-11-27", "Croissant:2026-11-26", "whole milk:2026-11-25"]));
  it("item Z to A", () => expect(ids("name-desc")[0]).toBe("whole milk:2026-11-25"));
  it("value high to low", () => expect(sortWaste(rows, "value-desc", n).map((x) => x.value)).toEqual([255, 170, 142.5]));
  it("value low to high", () => expect(sortWaste(rows, "value-asc", n)[0].value).toBe(142.5));
  it("quantity high to low", () => expect(sortWaste(rows, "qty-desc", n)[0].quantity).toBe(1500));
  it("quantity low to high", () => expect(sortWaste(rows, "qty-asc", n)[0].quantity).toBe(2));
});
