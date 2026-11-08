import { describe, expect, it } from "vitest";
import { matchingQuantity, nextBatchId, sameDayBatches } from "./duplicate-batches";

const b = (id: string, menuItemId: string, producedAt: string, quantity: number) => ({ id, menuItemId, producedAt, quantity, expiryDate: "2026-11-10" });

describe("duplicate batch detection", () => {
  const batches = [b("CRO-1109-A", "CRO", "2026-11-09T08:00", 24), b("CRO-1108-A", "CRO", "2026-11-08T08:00", 24), b("LAT-1109-A", "LAT", "2026-11-09T08:00", 24)];
  it("flags only same item on the same date", () => {
    expect(sameDayBatches(batches, "CRO", "2026-11-09").map((x) => x.id)).toEqual(["CRO-1109-A"]);
  });
  it("same quantity is a likely duplicate, different quantity is not", () => {
    const e = sameDayBatches(batches, "CRO", "2026-11-09");
    expect(matchingQuantity(e, 24)).toHaveLength(1);
    expect(matchingQuantity(e, 12)).toHaveLength(0);
  });
  it("suggests the next free batch letter", () => {
    expect(nextBatchId("CRO-1109", new Set(["CRO-1109-A"]))).toBe("CRO-1109-B");
    expect(nextBatchId("CRO-1109", new Set(["CRO-1109-A"]), ["CRO-1109-B"])).toBe("CRO-1109-C");
  });
});
