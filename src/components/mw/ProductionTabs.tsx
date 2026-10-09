import { Link } from "@tanstack/react-router";

/** Two-tab switch shared by Log Production and Add New Menu Item. */
export function ProductionTabs({ active }: { active: "log" | "add" }) {
  const cls = (on: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold transition ${on ? "bg-primary text-primary-foreground shadow" : "text-primary hover:bg-card"}`;
  return (
    <div role="tablist" className="mb-4 flex w-full max-w-sm gap-1 rounded-xl bg-secondary p-1">
      <Link role="tab" aria-selected={active === "log"} to="/log-production" search={{ item: undefined }} className={cls(active === "log")}>Log Production</Link>
      <Link role="tab" aria-selected={active === "add"} to="/menu/new" className={cls(active === "add")}>Add Menu Items</Link>
    </div>
  );
}
