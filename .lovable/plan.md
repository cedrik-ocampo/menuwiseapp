# Suggested batch purchase and production plan

## Decisions a café manager can make today
| Decision | Based on |
|---|---|
| Which items to keep, change the price of, or drop | Menu Map (popularity vs. margin), cost per item |
| Pricing | Recipe cost, food-cost %, margin per item |
| What to use up or sell first | Expiry watch, expiring batch alerts, "use it up" tips |
| What to do with expiring batches | Accept/Maybe/Reject on insights, logging what happened |
| Where waste comes from | Waste by reason, stage and day of the week |
| Which supplier to buy from (by hand) | Purchase history per ingredient |
| Who may manage stock | Inventory access setting per staff member |

## New decisions possible with data you already collect
- **How much to bake or prepare each day** (sales per weekday minus usual leftovers)
- **When to reorder each ingredient** (stock left, daily use, shelf life)
- **How much to buy each time** (enough until the next order, never more than can be used before it expires)
- Order less of items that often expire before they're used up
- Which weekdays to make smaller batches (days with high waste and low sales)

## What we'll build: "Suggested orders and batches" on Owner Home
1. **Ingredient reorder list.** For each ingredient:
   - Average daily use = usage over the last 4 weeks ÷ operating days
   - Days of stock left = stock in hand ÷ average daily use
   - Reorder by = today + days left − lead time (default 2 days, can be changed per ingredient)
   - Suggested amount = daily use × (days until next order + safety buffer), limited so it doesn't go past shelf life, and adjusted by the share that usually gets wasted
   - Shows: Order now / Order by date / OK, and "Not enough history" when there are fewer than 7 days of data
2. **Tomorrow's batch suggestion** for each produced or outsourced item: average sold on that weekday over the last 4 weeks, minus the average left over or wasted at closing, rounded up to the batch size.
3. Each suggestion shows how it was worked out ("Based on 4 Mondays: avg 22 sold, 3 wasted").
4. **Mark as ordered** opens the normal Purchase form with the amount already filled in, so it is saved and logged the usual way.
5. Staff with stock access can see the reorder list; only the owner sees costs.

## Technical details
- New pure module `src/lib/reorder.ts` (works offline in the browser, reads the local store), with unit tests for daily use, reorder date, the shelf-life limit, waste adjustment and the not-enough-history case.
- Optional `leadTimeDays` on Ingredient (default 2), editable on the ingredient detail page; no database change (records are JSON).
- Uses the café's operating days (from Reporting settings) and compatible-unit conversion.
- No admin changes; suggestions stay inside the café's own workspace.
