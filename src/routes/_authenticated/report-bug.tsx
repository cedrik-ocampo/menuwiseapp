import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bug, CheckCircle2 } from "lucide-react";
import { currentWorkspace } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/mw/AppShell";
import { Field, Panel, btnPrimary, inputCls } from "@/components/mw/ui";

export const Route = createFileRoute("/_authenticated/report-bug")({
  head: () => ({
    meta: [
      { title: "Report a Bug — MenuWise" },
      { name: "description", content: "Tell the MenuWise team about a problem in the app." },
      { property: "og:title", content: "Report a Bug — MenuWise" },
      { property: "og:description", content: "Tell the MenuWise team about a problem in the app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportBug,
});

function ReportBug() {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!title.trim() || !desc.trim()) { toast.error("Add a title and a description"); return; }
    if (!navigator.onLine) { toast.error("You're offline. Connect to the internet to send a report."); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const ws = currentWorkspace();
    const { error } = await supabase.from("bug_reports").insert({
      user_id: u.user!.id,
      workspace_id: ws ?? null,
      reporter_name: (u.user?.user_metadata?.full_name as string) ?? null,
      reporter_email: u.user?.email ?? null,
      title: title.trim().slice(0, 200),
      description: desc.trim().slice(0, 5000),
      page: document.referrer ? new URL(document.referrer).pathname : null,
      user_agent: navigator.userAgent.slice(0, 500),
    });
    setBusy(false);
    if (error) { toast.error("Couldn't send the report. Try again."); return; }
    setDone(true); setTitle(""); setDesc("");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle back={{ to: "/help", label: "Help & Contact" }} title="Report a Bug" subtitle="Tell the MenuWise team what went wrong. Your device and page details are attached automatically." />
      <Panel className="space-y-4">
        {done && <p className="flex gap-2 rounded-xl bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="h-5 w-5 shrink-0" /> Thanks! Your report was sent to the MenuWise team.</p>}
        <Field label="Title" required><input className={inputCls} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sales chart doesn't load" /></Field>
        <Field label="What happened?" required hint="What you did, what you expected, and what happened instead."><textarea className={`${inputCls} min-h-32 py-2`} maxLength={5000} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <button type="button" className={`${btnPrimary} w-full`} disabled={busy} onClick={() => void submit()}><Bug className="h-4 w-4" /> {busy ? "Sending…" : "Send report"}</button>
      </Panel>
    </div>
  );
}
