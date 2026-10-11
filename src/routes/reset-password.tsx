import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { btnPrimary, inputCls } from "@/components/mw/ui";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — MenuWise" },
      { name: "description", content: "Choose a new password for your MenuWise account." },
      { property: "og:title", content: "Set a new password — MenuWise" },
      { property: "og:description", content: "Choose a new password for your MenuWise account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <form
        className="w-full max-w-sm space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.length < 6) return setMsg("Password must be at least 6 characters");
          const { error } = await supabase.auth.updateUser({ password: pw });
          if (error) return setMsg(error.message);
          navigate({ to: "/" });
        }}
      >
        <h1 className="text-2xl font-bold text-primary">Set a new password</h1>
        <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <button className={`${btnPrimary} w-full`}>Save password</button>
      </form>
    </div>
  );
}
