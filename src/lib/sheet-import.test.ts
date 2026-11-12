import { describe, it, expect } from "vitest";
import { dateFromSheetName, rowsFromGrid } from "./import";
import { guessMapping } from "./column-mapper";

describe("multi-tab daily sheets", () => {
  const today = new Date(2026, 10, 12, 12);
  it("reads dates from tab names", () => {
    expect(dateFromSheetName("Nov 11", today)).toBe("2026-11-11");
    expect(dateFromSheetName("11 Nov", today)).toBe("2026-11-11");
    expect(dateFromSheetName("Dec 30", today)).toBe("2025-12-30");
    expect(dateFromSheetName("Sheet1", today)).toBe("");
  });
  it("skips title banner and footer rows", () => {
    const rows = rowsFromGrid([["☕ LOG SHEET"], [], ["Category", "Item Name", "OPENING", "CLOSING"], ["Milk", "Oat", 10, 7], ["Date:", "", "Verified By:"]]);
    expect(rows).toEqual([{ category: "Milk", itemname: "Oat", opening: "10", closing: "7" }]);
  });
  it("maps CLOSING to quantity and the tab date to purchase date", () => {
    const m = guessMapping(["ingredientname", "quantity", "purchasedate", "expirydate"], ["Item Name", "OPENING", "CLOSING", "sheetdate"]);
    expect(m.quantity.column).toBe("CLOSING");
    expect(m.purchasedate.column).toBe("sheetdate");
    expect(m.expirydate.column).toBeUndefined();
  });
});
