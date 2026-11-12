import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, ChevronRight, ArrowDownUp } from "lucide-react";
import type { Ingredient, Purchase } from "@/lib/types";
import { parseIngredientRows, INGREDIENT_UNITS, INGREDIENT_STORAGE } from "@/lib/import-parsers";
import { AuditCaption } from "@/components/mw/Audit";
import { ImportButton, type ParsedRow } from "@/components/mw/ImportButton";
import { INGREDIENT_CATEGORIES } from "@/components/mw/IngredientForm";
import { useDB, put, usePermissions } from "@/lib/store";
import { expiringWithin, lastUsed, nextLot, stockOf } from "@/lib/calc";
import { daysFromToday, formatPeso, fmtQty, shortDate, todayISO } from "@/lib/format";
import { useThreshold, thresholdLabel } from "@/lib/settings";
import { PageTitle } from "@/components/mw/AppShell";
import { Panel, SectionTitle, Segmented, btnPrimary, inputCls } from "@/components/mw/ui";
import { IngredientInventory } from "@/components/mw/IngredientInventory";

export const Route = createFileRoute("/_authenticated/ingredients/")({
  head: () => ({
    meta: [
      { title: "Ingredient Inventory — MenuWise" },
      { name: "description", content: "Keep stock visible and use the soonest-expiring ingredients first." },
      { property: "og:title", content: "Ingredient Inventory — MenuWise" },
      { property: "og:description", content: "Keep stock visible and use the soonest-expiring ingredients first." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inventory,
});

const COLS = "Ingredient_ID, Ingredient_Name, category, unit, quantity, unitCost, purchaseDate, expiryDate";

type SortKey = "expiry" | "purchase" | "lastUsed" | "alpha";
const SORT_LABEL: Record<SortKey, string> = { expiry: "Expiry", purchase: "Purchase date", lastUsed: "Last used", alpha: "Alphabetic" };

function Inventory() {
  const perm = usePermissions();
  const db = useDB();
  const [sort, setSort] = useState<SortKey>("expiry");
  const [asc, setAsc] = useState(true);
  const [view, setView] = useState<"Grid" | "List">("Grid");
  const [threshold] = useThreshold();
  const [splitOn, setSplitOn] = useState(false);
  const [delim, setDelim] = useState("()");

  const rows = useMemo(() => {
    const r = db.ingredients.map((i) => {
      const lot = nextLot(db, i.id);
      const lastP = db.purchases.filter((p) => p.ingredientId === i.id).map((p) => p.purchaseDate).sort().pop();
      return { i, lot, stock: stockOf(db, i.id), lastPurchase: lastP, lastUsed: lastUsed(db, i.id) };
    });
    const key = (x: (typeof r)[number]) =>
      sort === "expiry" ? x.lot?.expiryDate ?? "9999" : sort === "purchase" ? x.lastPurchase ?? "" : sort === "lastUsed" ? x.lastUsed ?? "" : x.i.name.toLowerCase();
    return r.sort((a, b) => (asc ? 1 : -1) * key(a).localeCompare(key(b)));
  }, [db, sort, asc]);

  const history = useMemo(() => {
    const name = (id: string) => db.ingredients.find((i) => i.id === id)?.name ?? id;
    const unit = (id: string) => db.ingredients.find((i) => i.id === id)?.unit ?? "";
    return [
      ...db.purchases.map((p) => ({ date: p.purchaseDate, kind: "Purchased", text: `${name(p.ingredientId)} · ${fmtQty(p.quantity)} ${unit(p.ingredientId)}`, id: p.ingredientId, value: p.quantity * p.unitCost })),
      ...db.usages.map((u) => ({ date: u.date, kind: "Used", text: `${name(u.ingredientId)} · ${fmtQty(u.quantity)} ${unit(u.ingredientId)}`, id: u.ingredientId, value: undefined })),
      ...db.wasteLogs.filter((w) => w.stage === "Ingredient" && w.ingredientId).map((w) => ({ date: w.at.slice(0, 10), kind: `Waste · ${w.wasteType}`, text: `${name(w.ingredientId!)} · ${fmtQty(w.quantity)} ${w.unit}`, id: w.ingredientId!, value: w.value })),
    ]
      .filter((h) => h.date <= todayISO())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12);
  }, [db]);

  const expiring = expiringWithin(db, threshold).length;

  const knownCats = useMemo(() => [...new Set([...INGREDIENT_CATEGORIES, ...db.ingredients.map((i) => i.category).filter(Boolean)])], [db.ingredients]);


  return (
    <div>
      <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Ingredient Inventory List" subtitle="Keep stock visible. Use the soonest-expiring ingredients first." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {perm.canInventory && <><div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">Import your ingredient inventory</p>
            <ImportButton
              what="ingredients"
              columns={COLS}
              className="h-12 w-full"
              parse={(rows) => parseIngredientRows(rows, db, splitOn && delim ? delim : undefined)}
              fields={{ category: { options: knownCats, allowCustom: true }, unit: { options: INGREDIENT_UNITS }, storage: { options: INGREDIENT_STORAGE }, purchasedate: { type: "date" }, expirydate: { type: "date" }, quantity: { type: "number" }, unitcost: { type: "number" } }}
              template={{ filename: "ingredients-template.csv", header: ["Ingredient_ID", "Ingredient_Name", "Category", "Storage", "Unit", "Supplier", "Purchase_Date", "Expiry_Date", "Quantity", "Unit_Cost", "Notes"], rows: [["ING-EXAMPLE", "Fresh milk", "Dairy", "Refrigerated", "L", "Example supplier", todayISO(), todayISO(), "10", "80", "Example starting stock"]] }}
              commit={(items) => items.forEach(({ ing, purchase }) => { if (!db.ingredients.some((i) => i.id === ing.id)) put("ingredients", ing); put("purchases", purchase); })}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={splitOn} onChange={(e) => setSplitOn(e.target.checked)} /> Supplier is in the item name</label>
              {splitOn && <>
                <select aria-label="Supplier separator" className={`${inputCls} w-auto`} value={["()", " - ", "/", "|", ","].includes(delim) ? delim : "custom"} onChange={(e) => setDelim(e.target.value === "custom" ? "" : e.target.value)}>
                  <option value="()">In brackets: Beans (Supplier)</option>
                  <option value=" - ">Dash: Beans - Supplier</option>
                  <option value="/">Slash: Beans / Supplier</option>
                  <option value="|">Bar: Beans | Supplier</option>
                  <option value=",">Comma: Beans, Supplier</option>
                  <option value="custom">Custom…</option>
                </select>
                {!["()", " - ", "/", "|", ","].includes(delim) && <input aria-label="Custom separator" placeholder="Type separator" className={`${inputCls} w-32`} value={delim} onChange={(e) => setDelim(e.target.value)} />}
              </>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Import · Required Columns: {COLS}.</p>
          </div>

          <Link to="/ingredients/new" className="flex items-center gap-2 text-sm font-semibold text-accent"><Plus className="h-4 w-4" /> Add one ingredient manually</Link></>}

          <Panel>
            <p className="mb-2 text-sm font-semibold text-accent">Sort Ingredients by</p>
            <div className="flex gap-2">
              <select className={inputCls} value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setAsc(e.target.value !== "lastUsed" && e.target.value !== "purchase" ? true : false); }}>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
              </select>
              <button className={`${btnPrimary} shrink-0`} onClick={() => setAsc(!asc)} aria-label="Toggle sort direction">
                {sort === "expiry" ? (asc ? "Soonest" : "Latest") : asc ? "Asc" : "Desc"} <ArrowDownUp className="h-4 w-4" />
              </button>
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2">
              <span className="text-3xl font-bold text-primary">{db.ingredients.length}</span><span className="text-sm text-muted-foreground">Ingredients in stock</span>
            </div>
            <Link to="/" className="flex items-center gap-3 rounded-full border border-warning-border bg-warning-soft px-4 py-2">
              <span className="text-3xl font-bold text-warning">{expiring}</span><span className="text-sm text-warning">Expire within {thresholdLabel(threshold)}</span>
            </Link>
          </div>

          <SectionTitle right={<Segmented value={view} options={["Grid", "List"]} onChange={(v) => setView(v as "Grid" | "List")} />}>Ingredients</SectionTitle>
          <p className="-mt-2 text-sm text-muted-foreground">{view === "Grid" ? "Tap a card to view, modify or delete." : "Select a row to view details."}</p>
          {view === "Grid" ? (
            <IngredientInventory db={db} rows={rows} threshold={threshold} />
          ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="bg-secondary px-4 py-3 text-xs font-bold uppercase text-primary">Ingredient / Stock</div>
            {rows.map(({ i, lot, stock, lastPurchase, lastUsed: lu }) => {
              const d = lot ? daysFromToday(lot.expiryDate) : null;
              const tone = d === null ? "text-muted-foreground" : d <= 0 ? "text-destructive" : d <= threshold ? "text-warning" : "text-muted-foreground";
              return (
                <Link key={i.id} to="/ingredients/$id" params={{ id: i.id }} className="block border-t border-border px-4 py-4 hover:bg-muted">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-primary">{i.name}</p>
                      <p className="text-sm text-muted-foreground">{i.id} · {fmtQty(stock)} {i.unit} on hand</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-accent" />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className={`font-semibold ${tone}`}>● Expiry {shortDate(lot?.expiryDate)}</span>
                    <span className="text-muted-foreground">{formatPeso(i.unitCost)} / {i.unit}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Purchased {shortDate(lastPurchase)} · Last used {shortDate(lu)}</p>
                  <AuditCaption collection="ingredients" record={i} />
                  {d !== null && d <= threshold && <p className={`mt-1 text-xs font-bold ${tone}`}>{d <= 0 ? "Expires today" : d === 1 ? "1 day left" : `${d} days left`}</p>}
                </Link>
              );
            })}
          </div>
          )}
          <p className="text-center text-xs text-muted-foreground">All {rows.length} ingredients shown · Updated {shortDate(todayISO())}</p>
        </div>

        <aside>
          <Panel>
            <SectionTitle>Ingredient history</SectionTitle>
            <p className="-mt-2 mb-3 text-xs text-muted-foreground">Recent purchases, uses and waste · newest first</p>
            <ul className="divide-y divide-border">
              {history.map((h, k) => (
                <li key={k}>
                  <Link to="/ingredients/$id" params={{ id: h.id }} className="flex justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">{shortDate(h.date)} · {h.kind}</span>
                      <span className="block truncate text-primary">{h.text}</span>
                    </span>
                    {h.value !== undefined && <span className="shrink-0 font-semibold text-primary">{formatPeso(h.value)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
