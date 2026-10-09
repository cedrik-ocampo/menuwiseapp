# Week-over-week waste + Sales chart order and overlap fixes

## Part 1 — Dashboard week dropdowns (Total Waste Value and Total Sales Value)

- Each card gets a single dropdown with: This Week (default), Last Week, 2 Weeks Ago … 7 Weeks Ago. This replaces "Today" / "vs yesterday". The two cards' dropdowns work independently.
- The big number shows the selected week's total. The waste stage breakdown also uses that week.
- Each week is compared with the week before it, labeled "vs Last Week", "vs 2 Weeks Ago", and so on. Weeks run Monday–Sunday.
  - This Week (Monday → today) is compared with the same weekdays of last week. The tooltip reads "Compares Monday–{weekday} of each period."
  - Every other week is compared full week to full week. "7 Weeks Ago" is compared with 8 weeks ago, which is calculated but not listed in the dropdown.
- Change = (selected − compared) / compared × 100.
  - Higher: red ▲. Lower: green ▼. Equal: grey "No change".
  - If the compared week is ₱0 or has no data: "—" with "No data for comparison period".
- No waste logs at all: ₱0.00 with no indicator.
- "Waste as % of Sales" only shows when both cards are set to the same week. Otherwise it shows "—", and the tooltip reads "Set both cards to the same period to see this ratio." Its green/amber/red coding stays the same.
- Card layout, colors and everything else on the Dashboard stay the same.

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

- `src/lib/calc.ts`: add `weekWindow(offset, today)` (the aligned window for offset 0) and `periodCompare(totalFn, offset)`, shared by both cards. `weeklyRevenue` keeps newest-first and the chart reverses it, or it is changed to oldest-first with the tests updated.
- `src/routes/_authenticated/index.tsx`: independent `wasteWeek` and `salesWeek` state (0–7); the ratio only shows when they are equal.
- `src/components/mw/SalesTab.tsx` `WeeklyRevenue`: reorder, `XAxis dataKey="key"` with a label tickFormatter, a compact peso formatter for labels, gaps and `maxBarSize`, domain `[0, max*1.15]`, and drop the fake "shown" height in favor of a minimum bar height.
- Tests: 8 unique keys, oldest → newest order, the aligned comparison (partial week, zero last week, zero this week), and a gap check (gap ≥ 15% of width/8).
