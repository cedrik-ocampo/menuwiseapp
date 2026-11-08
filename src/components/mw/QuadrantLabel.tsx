import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Quadrant } from "@/lib/calc";

export const QUADRANT_INFO: Record<Quadrant, string> = {
  Stars: "High sales, high profit — your best items. Keep them prominent and consistent.",
  Plowhorses: "High sales, low profit — popular but thin margins. Consider raising prices or lowering costs.",
  Puzzles: "Low sales, high profit — profitable but overlooked. Try better placement or promotion.",
  Dogs: "Low sales, low profit — weak performers. Consider reworking or removing them.",
};

export function QuadrantLabel({ quadrant, className }: { quadrant: Quadrant; className?: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className={className}>{quadrant}</p>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center">
          {QUADRANT_INFO[quadrant]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
