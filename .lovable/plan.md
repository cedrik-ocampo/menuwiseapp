# Fix the Menu Map bubble chart: centered cross with median labels

## Goal
The dashed cross always sits at the exact visual middle of the chart, so the four quadrants are equal squares. The real median values still show as labels on the lines.

## What changes
- The chart axes are centred on the medians: each axis extends equally above and below its median, wide enough to fit the farthest bubble plus a little padding. The median then lands exactly at 50% of the axis. Every bubble stays in its correct quadrant, so no item is shown on the wrong side.
- Vertical dashed line at the X midpoint, with a pill label at the top: "Median: 45 units".
- Horizontal dashed line at the Y midpoint, with a pill label at the right end: "Median: ₱35.00".
- Bubbles draw on top of the lines, and the quadrant name labels (Puzzles, Stars, Dogs, Plowhorses) line up with the centre cross.
- The quadrant layout stays standard: Stars top-right, Plowhorses bottom-right, Puzzles top-left, Dogs bottom-left. The uploaded brief swaps Plowhorses and Dogs, which would contradict the classification rules.
- The background grid lines are removed. Four softly tinted quadrant backgrounds replace them: Stars (top-right) green, Plowhorses (bottom-right) blue, Puzzles (top-left) amber, Dogs (bottom-left) red. They meet exactly at the centre cross, and each quadrant's name label is tinted to match.
- Visual polish: rounded chart frame, soft gradient tints in each quadrant (strongest at the outer corner), quadrant names as small coloured pills with an icon (star, plow, puzzle, dog-ear), translucent bubbles with a thin light outline and a gentle grow-on-hover effect, a lighter dashed cross, softer axis text, and a cleaner tooltip card that shows the item's quadrant colour.
- The classification logic doesn't change; this is only how the chart is drawn.

## Technical details
- File: `src/components/mw/MenuMapChart.tsx` only.
- Compute `halfX = max(|x − medianPop|) * 1.1` (minimum 1) and `halfY = max(|y − medianProfit|) * 1.1` (minimum 1). Domains are `[medianPop − halfX, medianPop + halfX]` and `[medianProfit − halfY, medianProfit + halfY]`, which makes the midpoint equal the median. Popularity can't be negative, so ticks below 0 are hidden with a tickFormatter (the space stays so the centre holds).
- Five evenly spaced explicit `ticks` per axis, so the centre tick sits on the line.
- `ReferenceLine` `label` props get custom SVG pill renderers (rect with card background plus bold text). Scatter is rendered after the reference lines so bubbles stay on top.
- Remove `CartesianGrid`. Draw four `ReferenceArea` rectangles from the domain edges to the medians, with low fill opacity (~0.08–0.12), using theme-friendly colours that work in both dark and light themes.
- Add quadrant colour tokens to `src/styles.css` (light and dark) and use them through CSS variables; don't hard-code colours.
- The quadrant label overlay offsets are matched to the chart margins so its 2×2 grid meets the cross.
- With one plotted item (no quadrants), keep the current behaviour.
- Check: the build log, plus a browser screenshot of /menu showing the cross centred and the labels readable.
