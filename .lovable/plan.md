# Sort options for the Sales log table

## What the user gets
A "Sort by" dropdown above the Sales log table, plus clickable column headers (Date, Menu Item, Quantity, Revenue) that flip between ascending and descending with a small arrow showing the current order.

Sort options:
1. Newest first (default, same as today)
2. Oldest first
3. Menu item A to Z
4. Menu item Z to A
5. Revenue: high to low
6. Revenue: low to high
7. Quantity: high to low
8. Quantity: low to high
9. Unit price: high to low

Ties fall back to newest date first, so rows stay predictable.

The chosen sort is remembered on this device, so the page opens the way it was left.

## Not changing
Totals, cards, the weekly chart, editing and deleting stay as they are. Only the row order changes.

## Technical details
- `src/components/mw/SalesTab.tsx`: add `sortKey` state (persisted in localStorage via `src/lib/prefs.ts` pattern), a `<select>` above the table, and sortable `<th>` buttons with `aria-sort`.
- Extract a pure `sortSales(rows, key, db)` helper in `src/lib/` with a small Vitest test (revenue high→low, name A→Z, tie-break by date).

## Optional ideas
- Search box to filter by menu item name.
- Date range filter (This week, Last 30 days).
- Show 50 rows with "Load more" to shorten the long list.
