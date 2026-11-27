# Waste Logs: show every log, with sorting and filtering

## What changes
- Rename the "Recent waste logs" section to **"Waste logs"**.
- Show **every** waste log, not just the latest 20.
- Above the list, add controls that match the Sales log:
  - **Sort by**: Newest first, Oldest first, Item A to Z, Item Z to A, Value high to low, Value low to high, Quantity high to low, Quantity low to high.
  - **Item** filter: pick one ingredient, menu item or custom-named item to see only its logs. The default is all items.
  - **Waste type** filter: All, Ingredient, Prep / WIP, Finished product.
- Clicking the Date, Quantity or Value column headers flips the sort order, the same way the Sales table does.
- Ties are broken by putting the newest date first. The chosen sort is remembered on this device.
- Each row keeps its current layout and edit/delete buttons. The existing rule that staff can edit only their own latest entry stays the same.

## Technical details
- New `src/lib/waste-sort.ts` with `WASTE_SORT_OPTIONS` and a pure `sortWaste(logs, key, nameOf)`, modelled on `sales-sort.ts`. Item names resolve from the ingredient, menu item, or `customName`.
- New `waste-sort.test.ts` with one test for each sort rule, plus the newest-first tie-break.
- `log-waste.tsx`: rename the section and pass all of `db.wasteLogs`, with no `.slice(0, 20)`.
- `WasteList` (in `WasteLogForm.tsx`) gets an optional `controls` prop. It adds the sort and filter controls and keeps the choice in localStorage under `menuwise:wasteSort`, using an SSR-safe read in an effect. Other places that use `WasteList`, such as detail pages, keep their current behaviour.
