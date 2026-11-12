import { describe, it, expect } from "vitest";
import { splitSupplier } from "./import-parsers";
describe("splitSupplier", () => {
  it("is off without a separator", () => {
    expect(splitSupplier("Specialty Beans (Plain Sight)", "").extracted).toBe(false);
  });
  it("splits brackets", () => {
    expect(splitSupplier("Specialty Beans (Plain Sight)", "", "()")).toEqual({ name: "Specialty Beans", supplier: "Plain Sight", extracted: true });
  });
  it("splits a custom separator", () => {
    expect(splitSupplier("Oat Milk - MilkLab", "", " - ")).toEqual({ name: "Oat Milk", supplier: "MilkLab", extracted: true });
  });
  it("keeps an explicit supplier", () => {
    expect(splitSupplier("Oat Milk - MilkLab", "Acme", " - ").extracted).toBe(false);
  });
});
