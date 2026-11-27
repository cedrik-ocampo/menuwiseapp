import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/mw/AppShell";
import { Callout } from "@/components/mw/ui";
import { WasteLogBrowser, WasteLogForm } from "@/components/mw/WasteLogForm";
import { WasteImport } from "@/components/mw/WasteImport";
import { DailyCloseout } from "@/components/mw/DailyCloseout";
import { useDB } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/log-waste")({
  head: () => ({
    meta: [
      { title: "Log Waste — MenuWise" },
      { name: "description", content: "Record a loss once, at the stage where it happened." },
      { property: "og:title", content: "Log Waste — MenuWise" },
      { property: "og:description", content: "Record a loss once, at the stage where it happened." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogWaste,
});

function Section({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-lg font-bold text-primary">
        {title}
        <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

const MAPPING = [
  ["Raw ingredient in storage", "Spoilage, expiry, damage", "Ingredient ID", "Ingredient Inventory / Individual Ingredient View"],
  ["Prep / WIP", "Prep error, spill during prep, burnt batch, wrong drink build", "Batch ID + Menu Item ID if known", "Individual Menu Item View as attributed/prep waste"],
  ["Finished product", "Unsold, day-old, near-expiry, finished drink spilled", "Menu Item ID + Batch ID", "Individual Menu Item View as direct finished-product waste"],
];

function LogWaste() {
  const db = useDB();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Log Waste" subtitle="Record the loss once, at the right stage." />
      <div className="space-y-4">
        <Callout tone="info" title="Log it where it happens">
          Log waste at the point of the process where it actually occurs. Roll up to a menu item only when the waste is direct or clearly attributable.
        </Callout>

        <div className="flex justify-end"><WasteImport /></div>
        <DailyCloseout />
        <Section title="Waste Log Form" open>
          <WasteLogForm />
        </Section>
        <Section title="Waste logs">
          <WasteLogBrowser logs={db.wasteLogs} />
        </Section>

        <Callout tone="warning" title="Avoid Double Counting">
          <ul className="list-disc space-y-1 pl-5">
            <li>If a finished croissant is discarded, do not also log its flour, butter, and sugar as wasted.</li>
            <li>If raw butter spoils, do not also log the equivalent croissants as wasted.</li>
            <li>Log the loss once, at the stage it happened.</li>
          </ul>
        </Callout>

        <Section title="Stage Mapping Table">
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-secondary text-xs uppercase text-primary">
                <tr>
                  <th className="p-3">Stage where loss happens</th>
                  <th className="p-3">What to log</th>
                  <th className="p-3">Link to</th>
                  <th className="p-3">Where it appears</th>
                </tr>
              </thead>
              <tbody>
                {MAPPING.map((r) => (
                  <tr key={r[0]} className="border-t border-border align-top">
                    <td className="p-3 font-semibold text-primary">{r[0]}</td>
                    <td className="p-3 text-muted-foreground">{r[1]}</td>
                    <td className="p-3 text-muted-foreground">{r[2]}</td>
                    <td className="p-3 text-muted-foreground">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Pastries and Finished Drink Guidance">
          <div className="grid gap-3 md:grid-cols-3">
            <Guide title="In-house pastries" items={["Baked croissants unsold at end of day → log as finished-product waste under croissant."]} />
            <Guide
              title="Made-to-order drinks"
              items={[
                "Milk spoils in fridge → log as ingredient waste under milk.",
                "Barista spills a finished latte → log as finished-product waste under latte.",
                "Wrong espresso shot pulled → log as WIP/prep waste, linked to latte if possible.",
              ]}
            />
            <Guide title="Outsourced items" items={["Usually do not track raw ingredients.", "Log as finished-product waste under the menu item."]} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Guide({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-semibold text-primary">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}
