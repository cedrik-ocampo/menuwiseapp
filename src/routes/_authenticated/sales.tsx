import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/mw/AppShell";
import { SalesTab } from "@/components/mw/SalesTab";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales — MenuWise" },
      { name: "description", content: "Track daily menu-item sales, revenue trends and sales history." },
      { property: "og:title", content: "Sales — MenuWise" },
      { property: "og:description", content: "Track daily menu-item sales, revenue trends and sales history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  return (
    <div>
      <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Sales" subtitle="Track daily sales and revenue by menu item." />
      <SalesTab compactHeader />
    </div>
  );
}