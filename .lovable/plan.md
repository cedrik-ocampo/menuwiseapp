# Admin: anonymous waste log list + day-of-week waste trend

## What the admin will see (Waste tab on a café's admin page)

1. **Waste logs (anonymous)** – a table of every waste log in the selected reporting period, newest first:
   - Date (with weekday, e.g. "Tue, Nov 24")
   - Quantity + unit
   - Reason
   - Stage (Ingredient / Finished Product / etc.)
   - Hidden: item names, staff names, peso values, notes, custom names.
   - Pagination (25 per page) and a total count. Follows the global period selector; no extra per-card filters.

2. **Waste by day of the week** – a bar chart Monday to Sunday for the selected period:
   - Each bar shows the number of waste logs that day (and total quantity per unit group in the tooltip).
   - Days with logs are highlighted; days with no logs are greyed out, and days the café is closed get a "Closed" label.
   - When the period covers several weeks, a small grid also shows each week (rows) × weekday (columns) with the log count, so you can see exactly which days had logs.
   - With "Compare" on, a faint second bar shows the previous period.

## Privacy
- The café's own Log Waste page does not change.
- Only date, quantity, unit, reason and stage are sent to the admin. Item names, staff, prices, and notes never are.
- The existing rule that hides small reason groups stays for the reason breakdown. The new list deliberately shows each reason per log, as you chose.

## Technical details
- `admin-privacy.ts`: add `waste.logs: {date, weekday, quantity, unit, reason, stage}[]` (period-filtered, sorted desc) and `waste.byWeekday` (7 entries: count, quantities per unit, operating flag, previous count) plus `waste.weekdayGrid` built from `reportingWeeks(period)`.
- `admin.$id.tsx`: new `WasteLogTable` and `WeekdayWastePanel` on the Waste tab using existing Card/Table/chart styles.
- Update AGENTS.md's admin-DTO rule to allow anonymized waste-log rows (no item/staff/value).
- Tests: logs contain no item/staff/value fields; weekday counts are correct for a known dataset; period filtering works.
