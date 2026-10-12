# Make the waste-stage breakdown explain the problem

## Dashboard changes
- Replace the passive three-value breakdown with three clearly selectable stage rows: **Ingredient**, **WIP**, and **Finished Product**.
- Keep each stage’s total prominent and add its share of the selected week’s waste, so the largest source stands out immediately.
- Selecting a stage opens an inline **Waste problems** section on the Dashboard for the same week already chosen in the Total Waste card.

## Waste problem details
- Show the selected stage’s waste occurrences ranked by highest value first.
- Each row will identify the affected ingredient or menu item, waste cause, date, quantity, and cost-based waste value.
- Ingredient and menu-item names will link to their existing detail pages, where the full related waste history is already available.
- Clearly label records that were not linked to an ingredient or menu item instead of hiding them.
- Include a concise empty state when the selected stage has no waste in that period.

## Visibility and interaction
- Visually emphasize the highest-cost stage and the currently selected stage using the existing MenuWise color tokens.
- Keep the drill-down compact on mobile and expanded enough to scan on larger screens.
- Add accessible button states and labels so the stage selector works with touch and keyboard controls.

## Technical details
- Extend the existing dashboard waste calculation to return the matching records as well as stage totals for the selected date window.
- Reuse the existing waste and item data; no database changes or new page are required.
- Add focused calculation tests for date-window filtering, stage totals, percentages, ordering, and unlinked records.
- Verify the selected-week drill-down on desktop and mobile, then confirm the preview has no build or runtime errors.
