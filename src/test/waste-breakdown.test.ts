import { describe, expect, it } from "vitest";
import { totalWaste } from "@/lib/calc";
import type { DBView } from "@/lib/store";
import type { WasteLog } from "@/lib/types";

const waste = (id: string, at: string, stage: WasteLog["stage"], value: number): WasteLog => ({
  id,
  at,
  stage,
  wasteType: stage === "WIP" ? "Prep Error" : "Spoilage",
  quantity: 1,
  unit: "unit",
  unitCost: value,
  value,
  allocation: "Direct",
});

describe("dashboard waste breakdown", () => {
  const db = {
    wasteLogs: [
      waste("before", "2026-09-30T12:00:00.000Z", "Ingredient", 99),
      waste("ingredient", "2026-10-05T12:00:00.000Z", "Ingredient", 30),
      waste("wip", "2026-10-06T12:00:00.000Z", "WIP", 70),
      waste("finished", "2026-10-07T12:00:00.000Z", "Finished Product", 50),
      waste("after", "2026-10-08T12:00:00.000Z", "WIP", 999),
    ],
  } as DBView;

  it("returns only the selected date window and totals every stage", () => {
    const result = totalWaste(db, "2026-10-05", "2026-10-07");
    expect(result.logs.map((log) => log.id)).toEqual(["ingredient", "wip", "finished"]);
    expect(result.total).toBe(150);
    expect(result.byStage).toEqual({ Ingredient: 30, WIP: 70, "Finished Product": 50 });
  });

  it("keeps zero-value stages available for a complete breakdown", () => {
    const result = totalWaste(db, "2026-10-06", "2026-10-06");
    expect(result.byStage).toEqual({ Ingredient: 0, WIP: 70, "Finished Product": 0 });
  });
});