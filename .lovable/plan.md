# Sales migration and Menu Map fixes

## Outcome
Sales becomes its own main page while preserving the existing sales entry, import, history, dashboard totals, and offline sync behavior. Menu Map returns to three views and only plots items backed by real sales.

## Build plan
1. **Promote Sales to the main navigation**
   - Add a protected `/sales` page with unique page metadata.
   - Use the requested order: Dashboard, Log Waste, Log Production, Menu Map, Sales, Ingredients.
   - Use compact mobile labels: Home, Waste, Production, Menu, Sales, Ingredients.
   - Show the existing amber queued-sync indicator on Sales whenever offline sale entries are pending; clear it after sync.
   - Keep Login outside the app navigation and preserve modal behavior.

2. **Add selectable Sales chart periods**
   - Add 5 Days, 1 Week, 2 Weeks, 30 Days (default), and 60 Days.
   - Recalculate chart rows and tick spacing for the selected period.
   - Keep Philippine peso formatting on the revenue axis.
   - Show “No sales in this period.” when the selected range has no entries.

3. **Correct Menu Map plotting**
   - Keep Bubble Chart as the default, followed by Table and Inventory.
   - Plot only menu items with sales in the last 30 days; keep zero-sales items in Table and Inventory.
   - Show “No sales data yet. Log sales to see the menu map.” when nothing can be plotted.
   - Derive quadrant boundaries from the median popularity and profitability of plotted items only.
   - For one plotted item, use that item as both boundaries and explain the case below the chart.
   - Keep popularity, profitability, waste size, waste intensity, and axis labels intact.

4. **Clarify the quadrant legend**
   - Make each underlined quadrant name hoverable and tappable.
   - Show compact definitions for Stars, Plowhorses, Puzzles, and Dogs using the team’s requested wording.

5. **Verify and clean up**
   - Verify Average Weekly Sales, menu-item Sales History, dashboard Sales KPIs, imports, manual entries, and offline queueing still use the same Sales collection.
   - Ensure there is one `/sales` page, no Sales sub-tab remains under Menu Map, and all six mobile tabs fit at 375px without overlap.
   - Run the relevant routing test and browser-check the central flows.

## Deferred
Part 5 in the team document is intentionally left unchanged until the team provides its requirements.

## Technical details
No database migration is required: Sales already syncs as a workspace-scoped record collection. This change reorganizes routes and presentation, and refines calculations over the existing records.
