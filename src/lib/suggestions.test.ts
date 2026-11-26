import { describe, expect, it } from "vitest";
import { addOpenDays, inferWeekdays, openDaysBetween, resolveCalendar, type OperatingCalendar } from "./operating-calendar";
import { compareCaps, DEFAULT_SETTINGS, projectLots, suggestBatch, suggestReorder, toStockUnit, weekdayDemand, type ReorderInput } from "./reorder";
import { classifyMenu, type MEItem } from "./menuEngineering";

const ALL: OperatingCalendar = { weekdays: [0, 1, 2, 3, 4, 5, 6], closures: [], confirmed: true };
const MON_SAT: OperatingCalendar = { weekdays: [1, 2, 3, 4, 5, 6], closures: [], confirmed: true };
const TODAY = "2026-11-25"; // Wednesday
const daily = (qty: number, days = 28, from = TODAY) => Array.from({ length: days }, (_, i) => ({ date: addOpenDays(ALL, from, 0) && shift(from, -(i + 1)), qty }));
function shift(d: string, n: number) { const [y, m, dd] = d.split("-").map(Number); return new Date(Date.UTC(y!, m! - 1, dd! + n)).toISOString().slice(0, 10); }

function input(over: Partial<ReorderInput> = {}): ReorderInput {
  return { today: TODAY, calendar: ALL, lots: [], onOrder: [], usage: daily(10), waste: [], leadTimeDays: 2, shelfLifeDays: null, dataDays: 28, settings: DEFAULT_SETTINGS, ...over };
}
const lot = (qty: number, expiry: string | null, received = "2026-11-20", id = "L") => ({ id, qty, received, expiry, estimated: false });

describe("operating calendar", () => {
  it("skips closed weekdays and one-off closures", () => {
    const cal = { ...MON_SAT, closures: [{ date: "2026-12-25" }] };
    expect(openDaysBetween(cal, "2026-12-21", "2026-12-27")).toBe(5); // Mon–Sat minus Christmas
    expect(addOpenDays(MON_SAT, "2026-11-28", 1)).toBe("2026-11-30"); // Sat → Mon
  });
  it("infers closed Sundays and stays unconfirmed", () => {
    const dates: string[] = [];
    for (let i = 1; i <= 28; i++) { const d = shift(TODAY, -i); if (new Date(d).getUTCDay() !== 0) dates.push(d); }
    expect(inferWeekdays(dates, shift(TODAY, -28), shift(TODAY, -1))).toEqual([1, 2, 3, 4, 5, 6]);
    const cal = resolveCalendar(undefined, dates, TODAY);
    expect(cal.confirmed).toBe(false);
    expect(suggestReorder(input({ calendar: cal })).confidence).toBe("Low");
  });
  it("closed days do not drag daily use down", () => {
    const usage = daily(12).filter((u) => new Date(u.date).getUTCDay() !== 0);
    expect(weekdayDemand(MON_SAT, usage, TODAY).average).toBe(12);
  });
});

describe("reorder", () => {
  it("stock covering lead time exactly → order now; one more day → order by tomorrow", () => {
    expect(suggestReorder(input({ lots: [lot(20, null)] })).status).toBe("Order now");
    const r = suggestReorder(input({ lots: [lot(30, null)] }));
    expect(r.status).toBe("Order by");
    expect(r.orderBy).toBe("2026-11-26");
  });
  it("order is 0 when stock plus on-order exceeds the target", () => {
    expect(suggestReorder(input({ lots: [lot(20, null)], onOrder: [{ qty: 500 }] })).order).toBe(0);
  });
  it("shelf-life cap beats pack rounding", () => {
    const r = suggestReorder(input({ lots: [lot(5, null)], shelfLifeDays: 3, packSize: 25 }));
    expect(r.shelfCap).toBe(40);
    expect(r.order).toBe(25);
  });
  it("a closed day inside the coverage window is skipped", () => {
    const usage = daily(10).filter((u) => new Date(u.date).getUTCDay() !== 0);
    const r = suggestReorder(input({ calendar: MON_SAT, usage, lots: [lot(30, null)], today: "2026-11-27" })); // Fri
    expect(r.stockoutDate).toBe("2026-12-01"); // Fri, Sat, Mon covered; Sunday skipped
  });
  it("converts mixed units", () => {
    expect(toStockUnit(250, "g", "kg")).toBe(0.25);
    expect(Number.isNaN(toStockUnit(1, "pc", "kg"))).toBe(true);
  });
  it("6 vs 7 days of history changes confidence", () => {
    expect(suggestReorder(input({ dataDays: 6 })).confidence).toBe("Low");
    expect(suggestReorder(input({ dataDays: 7 })).confidence).toBe("Medium");
  });
  it("zero use shows No recent use", () => {
    const r = suggestReorder(input({ usage: [] }));
    expect(r.status).toBe("No recent use");
    expect(r.order).toBe(0);
  });
  it("only avoidable waste reduces the order and the cap holds", () => {
    const base = input({ lots: [lot(5, null)] });
    const trim = suggestReorder({ ...base, waste: [{ date: shift(TODAY, -2), qty: 200, avoidable: false }] });
    const expired = suggestReorder({ ...base, waste: [{ date: shift(TODAY, -2), qty: 200, avoidable: true }] });
    expect(trim.wasteReductionPct).toBe(0);
    expect(expired.wasteReductionPct).toBe(30);
  });
  it("usage excludes waste", () => {
    const r = suggestReorder(input({ waste: [{ date: shift(TODAY, -1), qty: 100, avoidable: true }] }));
    expect(r.dailyUse).toBe(10);
  });
  it("compares waste caps 0/15/30/50 and never exceeds each cap", () => {
    const rows = compareCaps(input({ lots: [lot(5, null)], waste: [{ date: shift(TODAY, -2), qty: 280, avoidable: true }] }));
    expect(rows.map((r) => r.result.wasteReductionPct)).toEqual([0, 15, 30, 50]);
    expect(rows[0]!.result.order).toBeGreaterThan(rows[3]!.result.order);
  });
});

describe("lots", () => {
  const demand = () => 10;
  it("older lot expiring before the new lot arrives does not cap the new order", () => {
    const r = suggestReorder(input({ lots: [lot(100, "2026-11-26")], shelfLifeDays: 3 }));
    expect(r.shelfCap).toBe(40);
  });
  it("partly expiring lot reports at-risk quantity", () => {
    const p = projectLots(ALL, [lot(10, "2026-11-25")], () => 6, TODAY);
    expect(p.risks[0]!.atRisk).toBe(4);
  });
  it("later-received lot with an earlier expiry is used first", () => {
    const p = projectLots(ALL, [lot(10, "2026-12-30", "2026-11-01", "old"), lot(10, "2026-11-26", "2026-11-20", "new")], demand, TODAY);
    expect(p.risks.find((r) => r.id === "new")!.atRisk).toBe(0);
  });
  it("closed days burn shelf life without using stock", () => {
    const p = projectLots(MON_SAT, [lot(20, "2026-11-30")], demand, "2026-11-28"); // Sat, Sun closed, Mon
    expect(p.risks[0]!.atRisk).toBe(0);
    const q = projectLots(MON_SAT, [lot(20, "2026-11-29")], demand, "2026-11-28");
    expect(q.risks[0]!.atRisk).toBe(10);
  });
  it("estimated expiry is flagged", () => {
    expect(suggestReorder(input({ lots: [{ ...lot(5, "2026-12-30"), estimated: true }] })).notes).toContain("Expiry estimated");
  });
});

describe("batches", () => {
  const mondays = ["2026-11-23", "2026-11-16", "2026-11-09", "2026-11-02"];
  const base = { targetDate: "2026-11-30", calendar: ALL, waste: [], soldOutDates: [], carryover: 0, margin: 50, unitCost: 50, bufferPct: 0, dataDays: 28 };
  const sales = mondays.map((date, i) => ({ date, qty: [20, 22, 24, 40][i]! }));
  it("excludes sold-out days", () => {
    const r = suggestBatch({ ...base, sales, soldOutDates: ["2026-11-02"] });
    expect(r.median).toBe(22);
    expect(r.soldOutExcluded).toBe(1);
  });
  it("carryover reduces the batch", () => {
    expect(suggestBatch({ ...base, sales, carryover: 5 }).batch).toBe(18);
  });
  it("3 vs 4 same-weekday samples", () => {
    expect(suggestBatch({ ...base, sales }).confidence).toBe("High");
    expect(suggestBatch({ ...base, sales, soldOutDates: ["2026-11-02"] }).confidence).toBe("Medium");
  });
  it("rounds up for high margin, down for low margin", () => {
    const s = mondays.map((date) => ({ date, qty: 10 }));
    expect(suggestBatch({ ...base, sales: s, bufferPct: 5, margin: 90, unitCost: 10 }).batch).toBe(11);
    expect(suggestBatch({ ...base, sales: s, bufferPct: 5, margin: 10, unitCost: 90 }).batch).toBe(10);
  });
});

describe("menu engineering", () => {
  const S = { borderlinePct: 10, eligibilityDays: 28, categoryMin: 5 };
  const item = (id: string, units: number, price: number, over: Partial<MEItem> = {}): MEItem => ({ id, name: id, category: "Drinks", price, unitCost: 40, wasteCost: 0, unitsSold: units, openDaysAvailable: 28, soldOutDays: 0, daysListed: 40, perishables: [], ...over });
  it("a healthy menu does not produce half Dogs", () => {
    const r = classifyMenu([item("a", 280, 120), item("b", 300, 125), item("c", 290, 118), item("d", 310, 122), item("e", 270, 121), item("f", 295, 119)], S);
    expect(r.filter((x) => x.quadrant === "Dog").length).toBeLessThan(3);
  });
  it("a margin outlier does not move the median", () => {
    const r = classifyMenu([item("a", 100, 100), item("b", 100, 110), item("c", 100, 120), item("d", 100, 130), item("e", 100, 5000)], S);
    expect(r[0]!.marginThreshold).toBe(80);
  });
  it("under 28 days is too new", () => {
    expect(classifyMenu([item("a", 100, 100, { daysListed: 20 })], S)[0]!.status).toBe("too-new");
  });
  it("within 10% of a threshold is borderline with no removal advice", () => {
    const r = classifyMenu([item("a", 100, 100), item("b", 100, 110), item("c", 100, 120), item("d", 100, 130), item("e", 60, 105)], S);
    const e = r.find((x) => x.id === "e")!;
    expect(e.quadrant).toBe("Dog");
    expect(e.borderline).toBe(true);
    expect(e.action).not.toMatch(/remove/i);
  });
  it("a category with 4 items falls back to the whole menu", () => {
    const r = classifyMenu([item("a", 100, 100), item("b", 100, 110), item("c", 100, 120), item("d", 100, 130)], S);
    expect(r[0]!.scope).toBe("menu");
  });
  it("waste cost can change the quadrant", () => {
    const items = [item("a", 100, 100), item("b", 100, 110), item("c", 100, 120), item("d", 100, 130), item("e", 100, 125)];
    expect(classifyMenu(items, S).find((x) => x.id === "e")!.quadrant).toBe("Star");
    items[4] = item("e", 100, 125, { wasteCost: 3000 });
    expect(classifyMenu(items, S).find((x) => x.id === "e")!.quadrant).toBe("Plowhorse");
  });
  it("removal check separates shared and sole-use perishables", () => {
    const items = [item("a", 200, 200, { perishables: ["milk"] }), item("b", 200, 210), item("c", 200, 220), item("d", 200, 230), item("dog", 20, 50, { perishables: ["milk", "berry"] })];
    const dog = classifyMenu(items, S, [{ id: "milk", name: "Milk", expiryRatePct: 5 }, { id: "berry", name: "Berries", expiryRatePct: 40 }]).find((x) => x.id === "dog")!;
    expect(dog.quadrant).toBe("Dog");
    expect(dog.notes.some((n) => n.startsWith("Shares Milk"))).toBe(true);
    expect(dog.notes.some((n) => n.startsWith("Only user of Berries"))).toBe(true);
  });
});
