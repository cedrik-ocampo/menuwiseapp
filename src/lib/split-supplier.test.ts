import { describe, it, expect } from "vitest";
import { splitSupplier } from "./import-parsers";
describe("splitSupplier", () => {
  it("moves parenthetical supplier out of the name", () => {
    expect(splitSupplier("Specialty Beans (Plain Sight)", "")).toEqual({ name: "Specialty Beans", supplier: "Plain Sight", extracted: true });
  });
  it("keeps an explicit supplier and the name untouched", () => {
    expect(splitSupplier("Specialty Beans (Plain Sight)", "Acme").extracted).toBe(false);
  });
  it("leaves names without parentheses alone", () => {
    expect(splitSupplier("Monin Elderflower", "")).toEqual({ name: "Monin Elderflower", supplier: "", extracted: false });
  });
});
