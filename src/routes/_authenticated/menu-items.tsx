import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { PageTitle } from "@/components/mw/AppShell";
import { MenuImport } from "@/components/mw/MenuImport";
import { Button } from "@/components/ui/button";
import { MenuInventory } from "@/components/mw/MenuInventory";
import { Panel, btnPrimary } from "@/components/mw/ui";
import { menuMap } from "@/lib/calc";
import { useDB } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/menu-items")({
  validateSearch: (search: Record<string, unknown>) => ({
    item: typeof search.item === "string" ? search.item : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Menu Items — MenuWise" },
      { name: "description", content: "Add, find, and review the café's menu items and recipe costs." },
      { property: "og:title", content: "Menu Items — MenuWise" },
      { property: "og:description", content: "Add, find, and review the café's menu items and recipe costs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuItemsPage,
});

function MenuItemsPage() {
  const db = useDB();
  const { item } = Route.useSearch();
  const rows = useMemo(() => menuMap(db, false).rows, [db]);

  return (
    <div>
      <PageTitle back={{ to: "/", label: "Home" }} title="Menu Items" subtitle="Add, find, and review every item and its recipe cost.">
        <div className="flex flex-wrap gap-2"><MenuImport /><Button variant="outline" asChild><Link to="/menu/new"><Plus className="h-4 w-4" /> Add Menu Item</Link></Button></div>
      </PageTitle>
      <Panel>
        <MenuInventory db={db} rows={rows} focusId={item} />
      </Panel>
    </div>
  );
}