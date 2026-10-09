import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type Landing = "/" | "/sales" | "/menu";
export type Currency = "₱" | "P";
export interface Prefs { theme: Theme; landing: Landing; currency: Currency }

const KEY = "menuwise:prefs";
const DEFAULTS: Prefs = { theme: "light", landing: "/", currency: "₱" };
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULTS; }
}

export function setPrefs(p: Partial<Prefs>) {
  localStorage.setItem(KEY, JSON.stringify({ ...getPrefs(), ...p }));
  applyTheme();
  listeners.forEach((l) => l());
}

export function applyTheme() {
  if (typeof document === "undefined") return;
  const { theme } = getPrefs();
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function usePrefs(): Prefs {
  const [p, setP] = useState<Prefs>(DEFAULTS);
  useEffect(() => {
    const u = () => setP(getPrefs());
    u();
    listeners.add(u);
    return () => { listeners.delete(u); };
  }, []);
  return p;
}

/** Demo site: Delete account is disabled. */
export function isDemoMode(): boolean {
  if (import.meta.env.VITE_DEMO_MODE === "true") return true;
  return typeof window !== "undefined" && window.location.hostname === "screenshot-perfect-render-682.lovable.app";
}
