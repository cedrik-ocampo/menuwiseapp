import { useEffect, useState } from "react";

/** Device-remembered open/closed state for long Home lists. Starts collapsed; reads storage after mount (SSR-safe). */
export function useCollapsed(key: string): [boolean, (open: boolean) => void] {
  const storageKey = `mw.open.${key}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(localStorage.getItem(storageKey) === "1"); } catch { /* ignore */ }
  }, [storageKey]);
  return [open, (v: boolean) => { setOpen(v); try { localStorage.setItem(storageKey, v ? "1" : "0"); } catch { /* ignore */ } }];
}
