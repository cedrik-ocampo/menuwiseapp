# Bigger Menu Map chart with median labels outside the quadrants

## What changes
- The chart fills the full width of its section instead of stopping at a fixed narrow size, and grows taller on wide screens (wider-than-square shape on desktop, square on phones).
- Inner margins are trimmed so the coloured quadrants use as much space as possible.
- "Median: xxx units" moves above the chart's top edge, centred on the vertical dashed line.
- "Median: ₱xxx" moves outside the right edge, level with the horizontal dashed line.
- Neither label sits over the quadrants any more, so no bubbles are hidden. The dashed cross, colours, bubbles and classification stay the same.

## Technical details
- `src/components/mw/MenuMapChart.tsx`: remove `max-w-[640px]`; replace `aspect-square` with `aspect-square md:aspect-[4/3]`, plus a minimum height.
- Chart margin goes to about `{ top: 36, right: 96, bottom: 36, left: 8 }`, giving a top band and a right gutter for the labels.
- `PillLabel`: the top variant draws at `y - 18`, which is above the plot area. The right variant draws at `x + width + 8 + w/2`, which is in the right gutter. Only the label positions change.
- Check in the browser at 1280px and on mobile that the labels don't clip and the bubbles aren't covered.
