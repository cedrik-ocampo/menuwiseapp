# Week-over-week waste + Sales chart order and overlap fixes

## Part 1 — Dashboard Total Waste Value

- The big number shows waste **this week so far** (Monday → today), still summing Ingredient, WIP and Finished Product. The stage breakdown stays.
- The "Today" and "vs yesterday" dropdowns are removed because the comparison is now fixed. Nothing else on the card changes. The Total Sales card next to it follows the same this-week period, so "Waste as % of Sales" still compares the same days.
- Comparison: the same weekdays last week (Monday → the same weekday). Change = (this − last) / last × 100.
  - Higher: red ▲ "+X%". Lower: green ▼ "X% decrease". Equal: grey "No change".
  - Label "vs same days last week". The tooltip reads "Compares Monday–{weekday} of this week vs the same days last week."
- Empty cases:
  - No waste logs at all: ₱0.00 with no indicator.
  - Waste this week but none last week: "—" with "No data for last week".
  - Waste last week but none this week: ₱0.00 with green ▼ "100% decrease".

## Part 2 — Sales chart oldest → newest

- Bars run left to right: 7w | 6w | 5w | 4w | 3w | 2w | Last Week | This Week.
- Styling stays the same: navy bars, This Week lighter with a dashed outline, and flat grey ₱0.00 bars for empty weeks.
- Tooltips read "Week of {start}–{end}: ₱X". This Week reads "This Week (Mon–{today}): ₱X".
- The average line (last 4 full weeks), the empty state and ignoring future dates all stay as they are.

## Part 3 — Fix overlapping bars/labels

The cause isn't confirmed yet. The first step is to load the chart with test sales at 375, 768 and 1440 px and screenshot it to find what overlaps. Fixes applied regardless:
- Exactly 8 unique week keys, with the x-axis keyed on the week start date (unique) and showing the short label.
- `barCategoryGap="20%"`, a max bar width so bars never touch, and `type="category"` with 8 ticks.
- Top padding plus a y-axis that runs to max × 1.15, so the tallest label never clips.
- Short value labels (₱950, ₱12.5K, ₱1.2M), with the full amount in the tooltip. On narrow screens the label font is smaller.
- At 375 px the 8 x-axis labels tilt -30° when they don't fit. The chart keeps a sensible max width on very wide screens.
- Afterwards: re-screenshot all three widths and report the cause and the results.

## Technical details

- `src/lib/calc.ts`: add `wasteWeekOverWeek(db, today)` returning `{ cur, prev, pct, state }`. `weeklyRevenue` keeps newest-first and the chart reverses it, or it is changed to oldest-first with the tests updated.
- `src/routes/_authenticated/index.tsx`: remove the period/compare state and use the new helper. The sales total uses `weekStart() → today`.
- `src/components/mw/SalesTab.tsx` `WeeklyRevenue`: reorder, `XAxis dataKey="key"` with a label tickFormatter, a compact peso formatter for labels, gaps and `maxBarSize`, domain `[0, max*1.15]`, and drop the fake "shown" height in favor of a minimum bar height.
- Tests: 8 unique keys, oldest → newest order, the aligned comparison (partial week, zero last week, zero this week), and a gap check (gap ≥ 15% of width/8).
