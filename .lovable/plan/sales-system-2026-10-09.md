# Sales system

The app stays empty (no sample sales or menu items). The chart fills in as real sales are logged or imported.

## 1. Menu Map sub-tabs
Order: Bubble Chart (default) | Table | Sales | Inventory.

## 2. Sales tab
- Header: "Sales" + subtitle; buttons [Manual Entry] and [Import].
- 3 KPI cards: Today's Revenue, This Week's Revenue, Top Seller (name + units this week).
- Line chart: revenue per day, last 30 days, ₱ axis.
- Sales log table: Date | Menu Item | Quantity | Unit Price | Revenue | Notes | Actions (edit, delete). Newest first, row opens the menu item, "Edited by…" caption, empty state "No sales logged yet."

## 3. Manual Entry (pop-up, same style as other forms)
Date (today), searchable menu item picker, quantity, unit price (auto-filled from retail price, editable), revenue (read-only), notes, Save. Also used to edit a sale.

## 4. Import
- Required Columns: sale_date, menu_item_id, quantity. Optional: unit_price, notes.
- Missing columns: "Cannot import — missing required columns: {list}."
- Row checks: valid date, not in the future, no older than 1 year; menu item ID must exist (shows row + the unknown ID); quantity a whole number > 0; unit price ≥ 0 if given, blank = retail price.
- Same date + item as an existing entry: flagged as a possible duplicate in the check screen, with a "Skip duplicates" toggle (on by default).
- After import: "Imported X rows. Y rows skipped — download the error report." The error report is a CSV of row numbers and reasons.
- Download Template: `menuwise-sales-template.csv` with the headers and 3 example rows. The examples use your real menu items when you have them, otherwise Spanish Latte / Almond Croissant / Matcha Cheesecake placeholder IDs.

## 5. Bubble chart
- Popularity = units sold over the last 30 days ÷ (30/7). Items with no sales sit at 0 on the left edge, not hidden.
- Caption under the chart: "Popularity = average units sold per week over the last 30 days."

## 6. Menu Item View
- "Average Weekly Sales" uses the same 30-day average.
- The old "Record sales" box is replaced by an [Add Sale] button that opens Manual Entry with this item picked.
- New "Sales History" section below Waste History: last 30 days, Date | Quantity | Unit Price | Revenue, newest first, with the total revenue.

## 7. Dashboard
- New "Total Sales Value" card next to Total Waste Value, for the selected period.
- Caption: "Waste is X% of sales". Green under 3%, amber 3–5%, red over 5%. Shows "—" when there are no sales.

## Edge cases
- Sales but no waste: the bubble is shown at minimum size, in green.
- Waste but no sales: the item is shown at popularity 0.
- Old sales entries without a price use the item's current retail price.
- Deleting a menu item still removes its sales.

## Technical details
- Sales stay in the existing synced "sales" collection, which works offline, uses last-write-wins and is shared per café. No new database table, so the team's `sales_entries` columns become fields on that collection instead.
- `Sale` gains `unitPrice?`, `notes?`, `revenue?`; creator/editor fields come from the existing audit stamping.
- New `src/components/mw/SalesTab.tsx` and `SaleDialog.tsx`; `avgWeeklySales` in `calc.ts` changed to the 30-day rolling average.
- The duplicate check and the error report CSV are added to the shared ImportButton as optional features.
