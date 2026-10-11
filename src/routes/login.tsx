import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPrefs } from "@/lib/prefs";
import { z } from "zod";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import logo from "@/assets/mw-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { btnPrimary } from "@/components/mw/ui";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — MenuWise" },
      { name: "description", content: "Log in to MenuWise to see how your café is doing today." },
      { property: "og:title", content: "Log in — MenuWise" },
      { property: "og:description", content: "Less waste. More possibility. Smarter decisions for cafés & bakeries." },
    ],
  }),
  component: Login,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: getPrefs().landing }));
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (mode === "forgot") {
      const r = z.string().email().safeParse(email.trim());
      if (!r.success) return setMsg({ tone: "error", text: "Enter a valid email address" });
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      return setMsg(error ? { tone: "error", text: error.message } : { tone: "ok", text: "Check your email for a reset link." });
    }
    const r = schema.safeParse({ email, password });
    if (!r.success) return setMsg({ tone: "error", text: r.error.issues[0].message });
    if (mode === "signup" && password !== confirmPassword) return setMsg({ tone: "error", text: "Passwords don't match" });
    if (!navigator.onLine) return setMsg({ tone: "error", text: "You're offline. Connect once to sign in on this device." });
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email: r.data.email, password: r.data.password, options: { emailRedirectTo: window.location.origin, data: { cafe_name: "My Café" } } });
      setBusy(false);
      if (error) return setMsg({ tone: "error", text: error.message });
      if (data.session) return navigate({ to: getPrefs().landing });
      return setMsg({ tone: "ok", text: "Check your email to confirm your account, then log in." });
    }
    const { error } = await supabase.auth.signInWithPassword(r.data);
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    navigate({ to: getPrefs().landing });
  }

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-2">
      <div className="flex flex-col items-center justify-center bg-header px-6 py-12 text-center text-header-foreground">
        <img src={logo.url} alt="MenuWise logo" className="h-32 w-auto md:h-44" />
        <h1 className="mt-4 text-4xl font-bold">MenuWise</h1>
        <p className="mt-3 text-xl font-semibold opacity-90">Less waste. More possibility.</p>
        <p className="mt-3 text-sm opacity-80">Smarter decisions for cafés & bakeries.</p>
      </div>
      <div className="flex items-center justify-center px-6 py-10">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-3xl font-bold text-primary">{mode === "signup" ? "Create account" : mode === "forgot" ? "Reset password" : "Welcome back"}</h2>
            <p className="mt-1 text-muted-foreground">{mode === "login" ? "Log in to see how your café is doing today." : mode === "signup" ? "Set up MenuWise for your café." : "We'll email you a reset link."}</p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-primary">Email address</span>
            <span className="flex h-12 items-center gap-3 rounded-xl border border-input bg-card px-4">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <input type="email" autoComplete="email" className="w-full bg-transparent outline-none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </span>
          </label>
          {mode !== "forgot" && (
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-primary">Password</span>
              <span className="flex h-12 items-center gap-3 rounded-xl border border-input bg-card px-4">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <input type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="w-full bg-transparent outline-none" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
                  {show ? <Eye className="h-5 w-5 text-muted-foreground" /> : <EyeOff className="h-5 w-5 text-muted-foreground" />}
                </button>
              </span>
            </label>
          )}
          {mode === "signup" && (
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-primary">Confirm password</span>
              <span className="flex h-12 items-center gap-3 rounded-xl border border-input bg-card px-4">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <input type={show ? "text" : "password"} autoComplete="new-password" className="w-full bg-transparent outline-none" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </span>
            </label>
          )}
          {mode === "login" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">For safety, inactive sessions end after 30 minutes.</span>
              <button type="button" className="font-semibold text-accent" onClick={() => setMode("forgot")}>Forgot password?</button>
            </div>
          )}
          {msg && <p className={`rounded-lg p-3 text-sm ${msg.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-info-soft text-primary"}`}>{msg.text}</p>}
          <button disabled={busy} className={`${btnPrimary} h-12 w-full`}>
            <ArrowRight className="h-4 w-4" /> {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Log in"}
          </button>
          <p className="text-center text-sm">
            {mode === "login" ? (
              <button type="button" className="font-semibold text-accent" onClick={() => setMode("signup")}>Need access? Create a café account</button>
            ) : (
              <button type="button" className="font-semibold text-accent" onClick={() => setMode("login")}>Back to log in</button>
            )}
          </p>
          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Your café's data, safely in one place.</p>
        </form>
      </div>
    </div>
  );
}
