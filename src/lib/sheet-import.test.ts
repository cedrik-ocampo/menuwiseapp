import { describe, it, expect } from "vitest";
import { chronologicalSheets, dateFromSheetName, rowsFromGrid } from "./import";
import { guessMapping } from "./column-mapper";

describe("multi-tab daily sheets", () => {
  const today = new Date(2026, 10, 12, 12);
  it("imports selected sheets from earliest to latest regardless of selection order", () => {
    const sheets = [
      { name: "Nov 11", date: "2026-11-11", rows: [{ itemname: "Milk" }] },
      { name: "Nov 4", date: "2026-11-04", rows: [{ itemname: "Milk" }] },
      { name: "Nov 8", date: "2026-11-08", rows: [{ itemname: "Milk" }] },
    ];
    expect(chronologicalSheets(sheets).map((s) => s.date)).toEqual(["2026-11-04", "2026-11-08", "2026-11-11"]);
    expect(sheets[0].name).toBe("Nov 11");
  });
  it("requires a date for each selected sheet when importing multiple sheets", () => {
    expect(() => chronologicalSheets([
      { name: "Nov 4", date: "2026-11-04", rows: [] },
      { name: "Stock", date: "", rows: [] },
    ])).toThrow("Set a date for every selected sheet");
  });
  it("keeps single undated sheets supported", () => {
    expect(chronologicalSheets([{ name: "Stock", date: "", rows: [] }])[0].name).toBe("Stock");
  });
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
