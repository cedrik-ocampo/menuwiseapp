import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircleQuestion } from "lucide-react";
import { PageTitle } from "@/components/mw/AppShell";
import { Callout, Panel, SectionTitle, btnPrimary } from "@/components/mw/ui";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({ meta: [
    { title: "Help & Contact — MenuWise" },
    { name: "description", content: "Get help with MenuWise or contact the MenuWise team." },
    { property: "og:title", content: "Help & Contact — MenuWise" },
    { property: "og:description", content: "Get help with MenuWise or contact the MenuWise team." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Help,
});

function Help() {
  return <div className="mx-auto max-w-2xl">
    <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Help & Contact" subtitle="Support for your café’s MenuWise account." />
    <Panel className="space-y-4">
      <SectionTitle>Contact MenuWise</SectionTitle>
      <p className="text-sm text-muted-foreground">Include your café name and a short description of what happened. Do not include your password.</p>
      <a href="mailto:menuwise.contact@gmail.com?subject=MenuWise%20Support" className={btnPrimary}><Mail className="h-4 w-4" /> Email menuwise.contact@gmail.com</a>
      <Link to="/report-bug" className="block text-sm font-semibold text-accent">Found a problem? Report a bug →</Link>
      <Callout tone="info" title="Before you contact us"><p>Check your internet connection and try the action once more. Offline entries remain on this device and sync when you reconnect.</p></Callout>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><MessageCircleQuestion className="h-4 w-4" /> Account access and café invitations require an internet connection.</p>
    </Panel>
  </div>;
}