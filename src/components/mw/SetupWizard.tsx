import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { useDB } from "@/lib/store";
import { Panel, SectionTitle } from "./ui";

const HIDE_KEY = "mw-setup-wizard-hidden";

export function SetupWizard({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const db = useDB();
  const [hidden, setHidden] = useState(true);
  useEffect(() => { setHidden(!alwaysShow && localStorage.getItem(HIDE_KEY) === "1"); }, [alwaysShow]);
  const steps = [
    { n: 1, title: "Ingredients & stock", to: "/ingredients", count: db.ingredients.length, unit: "ingredients", note: "Costs, units and current stock. Do this first." },
    { n: 2, title: "Menu items & recipes", to: "/menu-items", count: db.menuItems.length, unit: "menu items", note: "Recipes match ingredients by name.", needs: db.ingredients.length === 0 ? "Import ingredients first" : null },
    { n: 3, title: "Sales", to: "/sales", count: db.sales.length, unit: "sales", note: "Past sales for popularity and revenue.", needs: db.menuItems.length === 0 ? "Import menu items first" : null },
    { n: 4, title: "Production", to: "/log-production", count: db.batches.length, unit: "batches", note: "Deducts ingredients used.", needs: db.menuItems.length === 0 ? "Import menu items first" : null },
    { n: 5, title: "Waste", to: "/log-waste", count: db.wasteLogs.length, unit: "waste logs", note: "Builds your waste-to-sales ratio.", needs: db.menuItems.length === 0 ? "Import menu items first" : null },
  ] as const;
  const done = steps.filter((s) => s.count > 0).length;
  if (!alwaysShow && (hidden || done === steps.length)) return null;

  return (
    <Panel className="space-y-3">
      <SectionTitle right={!alwaysShow ? (
        <button type="button" aria-label="Hide setup guide" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => { localStorage.setItem(HIDE_KEY, "1"); setHidden(true); }}><X className="h-4 w-4" /></button>
      ) : undefined}>Set up your café data · {done}/5 done</SectionTitle>
      <p className="text-sm text-muted-foreground">Import your spreadsheets in this order. Each step opens its page, where you can download the template and use Import.</p>
      <ol className="space-y-2">
        {steps.map((s) => {
          const ok = s.count > 0;
          const needs = "needs" in s ? s.needs : null;
          return (
            <li key={s.n}>
              <Link to={s.to} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${ok ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{ok ? <Check className="h-4 w-4" /> : s.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{ok ? `${s.count} ${s.unit} loaded` : needs ?? s.note}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
