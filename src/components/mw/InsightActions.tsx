import { Check, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currentUser, put } from "@/lib/store";
import { shortDate } from "@/lib/format";
import type { InsightResponse } from "@/lib/types";

const SNOOZE = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
];

const btn = "inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md text-xs font-semibold transition-colors";

export function InsightActions({ id, label }: { id: string; label: string }) {
  function respond(status: InsightResponse["status"], until?: string) {
    put("insightResponses", { id, status, until, at: new Date().toISOString(), byName: currentUser().name, label });
  }
  return (
    <div className="flex gap-1 border-t border-border/60 p-1.5">
      <button type="button" className={`${btn} text-success hover:bg-success/10`} onClick={() => { respond("accepted"); toast.success("Marked as done"); }}>
        <Check className="h-3.5 w-3.5" /> Accept
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={`${btn} text-primary hover:bg-secondary`}><Clock className="h-3.5 w-3.5" /> Maybe</button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="center">
          <p className="px-2 pb-1 text-xs font-semibold text-muted-foreground">Remind me in</p>
          {SNOOZE.map((o) => (
            <button
              key={o.hours}
              type="button"
              className="block w-full rounded-md px-2 py-2 text-left text-sm text-primary hover:bg-secondary"
              onClick={() => {
                const until = new Date(Date.now() + o.hours * 3600_000);
                respond("snoozed", until.toISOString());
                toast.message(`Snoozed until ${shortDate(until.toISOString())} ${until.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
              }}
            >
              {o.label}{o.hours === 24 ? " · default" : ""}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <button type="button" className={`${btn} text-destructive hover:bg-destructive/10`} onClick={() => { respond("rejected"); toast.message("Insight dismissed"); }}>
        <X className="h-3.5 w-3.5" /> Reject
      </button>
    </div>
  );
}
