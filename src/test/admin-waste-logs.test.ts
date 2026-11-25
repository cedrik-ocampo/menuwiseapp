import { describe, expect, it } from "vitest";
import { anonymousWaste } from "@/lib/admin-privacy";
import { resolvePeriod } from "@/lib/admin-periods";
import type { WasteLog } from "@/lib/types";

const log = (at: string, quantity: number): WasteLog => ({ id: at + quantity, at, stage: "Finished Product", menuItemId: "secret-item", quantity, unit: "pcs", wasteType: "Expiry", value: 99, notes: "secret" } as unknown as WasteLog);
const period = resolvePeriod({ key: "this-week" } as never, "2026-11-25");

describe("anonymous admin waste logs", () => {
  const result = anonymousWaste([log("2026-11-23", 2), log("2026-11-25", 3), log("2026-11-25", 1), log("2026-11-10", 9)], period, [0, 1, 2, 3, 4, 5, 6]);
  it("hides item, value and note fields", () => {
    expect(Object.keys(result.logs[0]!).sort()).toEqual(["date", "quantity", "reason", "stage", "unit", "weekday"]);
  });
  it("only includes logs in the period", () => expect(result.logs).toHaveLength(3));
  it("counts logs per weekday", () => {
    expect(result.byWeekday.map((day) => day.count)).toEqual([1, 0, 2, 0, 0, 0, 0]);
    expect(result.byWeekday[2]!.quantities["pcs"]).toBe(4);
  });
});
