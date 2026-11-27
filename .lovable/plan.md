# Fix the Menu Map bubble chart: centered cross with median labels

## Goal
The dashed cross always sits at the exact visual middle of the chart, so the four quadrants are equal squares. The real median values still show as labels on the lines.

## What changes
- The chart axes are centred on the medians: each axis extends equally above and below its median, wide enough to fit the farthest bubble plus a little padding. The median then lands exactly at 50% of the axis. Every bubble stays in its correct quadrant, so no item is shown on the wrong side.
- Vertical dashed line at the X midpoint, with a pill label at the top: "Median: 45 units".
- Horizontal dashed line at the Y midpoint, with a pill label at the right end: "Median: ₱35.00".
- Bubbles draw on top of the lines, and the quadrant name labels (Puzzles, Stars, Dogs, Plowhorses) line up with the centre cross.
- The quadrant layout stays standard: Stars top-right, Plowhorses bottom-right, Puzzles top-left, Dogs bottom-left. The uploaded brief swaps Plowhorses and Dogs, which would contradict the classification rules.
- The classification logic doesn't change; this is only how the chart is drawn.

## Technical details
- File: `src/components/mw/MenuMapChart.tsx` only.
- Compute `halfX = max(|x − medianPop|) * 1.1` (minimum 1) and `halfY = max(|y − medianProfit|) * 1.1` (minimum 1). Domains are `[medianPop − halfX, medianPop + halfX]` and `[medianProfit − halfY, medianProfit + halfY]`, which makes the midpoint equal the median. Popularity can't be negative, so ticks below 0 are hidden with a tickFormatter (the space stays so the centre holds).
- Five evenly spaced explicit `ticks` per axis, so the centre tick sits on the line.
- `ReferenceLine` `label` props get custom SVG pill renderers (rect with card background plus bold text). Scatter is rendered after the reference lines so bubbles stay on top.
- The quadrant label overlay offsets are matched to the chart margins so its 2×2 grid meets the cross.
- With one plotted item (no quadrants), keep the current behaviour.
- Check: the build log, plus a browser screenshot of /menu showing the cross centred and the labels readable.
