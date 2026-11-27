# Sort and filter the Production logs

Applies to the production log on **Log Production** and the **Production History** on Menu Items (both use the same list, so one change covers both).

## What you'll see above the list
- **Sort by** dropdown, matching Sales and Waste:
  - Newest first (default) / Oldest first
  - Item A to Z / Item Z to A
  - Quantity: high to low / low to high
  - Expiry: soonest first / latest first
- **Menu item** filter: "All items" or one item (only items that have production entries).
- **Expiry status** filter: All · Not expired · Expiring today · Expired.
- A count like "Showing 12 of 140 entries", with a "Clear filters" link when a filter is on.
- Your sort choice is remembered on this device; filters reset when you leave the page.
- "Show more" keeps working on the filtered list.

## Unchanged
- Edit pencil, who-logged-it caption, item links, and permissions stay exactly as now.

## Technical details
- New browser-safe `src/lib/production-sort.ts` (`PRODUCTION_SORT_OPTIONS`, `sortBatches`, `filterBatches`) mirroring `waste-sort.ts`; ties fall back to newest first.
- Tests in `src/test/production-sort.test.ts`: each sort order, item filter, expiry-status filter using Manila "today".
- `ProductionHistory` in `src/components/mw/History.tsx` gets the controls; sort persisted in localStorage key `menuwise:productionSort`, read after mount.
