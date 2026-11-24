import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { PageTitle } from "@/components/mw/AppShell";
import { Panel } from "@/components/mw/ui";

export const Route = createFileRoute("/_authenticated/whats-new")({
  head: () => ({ meta: [
    { title: "What’s New — MenuWise" },
    { name: "description", content: "See recent MenuWise improvements and release notes." },
    { property: "og:title", content: "What’s New — MenuWise" },
    { property: "og:description", content: "See recent MenuWise improvements and release notes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: WhatsNew,
});

const releases = [
  { version: "1.6.0", date: "November 24, 2026", notes: ["New café owners now see a welcome setup guide the first time they sign in.", "Closing the setup guide now hides it for that café only, so new accounts always see it.", "Log Waste lets you type any item as needed, even if it isn't on your menu yet, and suggests names you've used before.", "Owners can turn a typed waste item into a menu item later, and past waste logs link to it.", "MenuWise admins now see only percentages, trends and counts. Item and ingredient names are hidden from them."] },
  { version: "1.5.0", date: "November 15, 2026", notes: ["A notification bell shows owners and staff when MenuWise admins add, edit or review café data.", "Imports can read several spreadsheet tabs at once and save them in date order, earliest first.", "Imports now have a column-matching step, optional supplier splitting, and a default expiry date when none is given.", "Owners can give individual staff members permission to manage inventory."] },
  { version: "1.4.0", date: "November 1, 2026", notes: ["Staff have their own Home page with daily logs, expiry alerts and team activity.", "Staff can quickly add a missing menu item while logging. It is marked for the owner to review.", "Owners must choose a new café owner before deleting their account.", "A setup guide helps you name your café, invite your team and import your data."] },
  { version: "1.3.0", date: "October 12, 2026", notes: ["Business Profile now shows pending café invitations.", "Account creation confirms passwords before continuing.", "Inactive sessions now close automatically after a warning.", "Help, contact, and release notes are available from the account menu."] },
  { version: "1.2.0", date: "October 9, 2026", notes: ["Sales now has its own main tab and offline sync indicator.", "Dashboard waste and sales cards support weekly comparisons.", "Profile, appearance, landing page, and currency preferences were added."] },
];

function WhatsNew() {
  return <div className="mx-auto max-w-3xl">
    <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="What’s New" subtitle="Recent MenuWise improvements and fixes." />
    <div className="space-y-4">{releases.map((release, index) => <Panel key={release.version} className={index === 0 ? "border-accent" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold text-primary">MenuWise {release.version}</h2><span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" />{release.date}</span></div>
      <ul className="mt-4 space-y-2">{release.notes.map((note) => <li key={note} className="flex gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>{note}</span></li>)}</ul>
    </Panel>)}</div>
  </div>;
}