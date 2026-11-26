# Suggested orders, batches and menu suggestions

## 1. Operating calendar (build first)
Everything else depends on knowing which days the café is open.

**What the owner sets (Profile → Reporting settings)**
- Weekly pattern: tick open days, e.g. Mon–Sat open, Sunday closed (the existing toggles).
- One-off closures: add a date + optional note (e.g. Dec 25 "Christmas"). Shown as a short list with remove buttons.
- No opening/closing hours.

**If the owner hasn't confirmed it**
- The app guesses: a day counts as open if it had any sales or logged activity in the last 4 weeks.
- A small banner on Owner Home asks: "It looks like you're closed Sundays — is that right?" with **Yes, save** / **Change**.
- Until confirmed, every suggestion is capped at **Low** confidence and says "Open days estimated".

**How it is used**
- Daily use = usage ÷ open days only (closed days never drag the average down).
- "Days of stock left" is turned into a real date by skipping closed days.
- Stock projection: stock is used only on open days, but expiry counts every calendar day — so a long closure shows stock expiring unused.
- Closed days are never treated as zero-sales days in batch or menu numbers.

## 2. Ingredient reorder list
Status per ingredient: **Order now**, **Order by [date]**, **OK**, **No recent use**.

- **Daily use:** weekday-weighted median of the last 4 weeks ÷ open days. Waste is excluded from usage so it isn't counted twice. Zero use → "No recent use" (no divide by zero).
- **Stock as lots (earliest-expiry first):** each purchase is a lot with remaining qty and expiry. Missing expiry = received date + default shelf life, tagged "expiry estimated". Day by day over the calendar: first write off expired lots, then (on open days only) use that day's demand from the earliest-expiring lot.
- Outputs: usable stock, run-out date, and at-risk quantity per lot ("4 of 10 in Thursday's lot will likely expire unused").
- **On order:** open purchases count, arriving today + lead time, so the same order isn't suggested twice.
- **Reorder by** = run-out date − lead time (counted in open days). Lead time default 2, editable per ingredient.
- **Coverage** = lead time + open days until the following order + safety buffer.
- **Order** = daily use × coverage − (usable stock + on order).
- **Shelf-life cap:** new lot arrives A, expires E = A + shelf life. Order ≤ demand on open days between A and E − older usable stock still on hand at A. Then round **down** to pack size; supplier minimum only if the cap allows.
- **Waste adjustment:** reduce only for avoidable waste (expired, overproduced, unsold), never trim/spillage/yield loss; total reduction never exceeds the waste cap (default 30%). Says why: "Ordering 20% less: 3 of the last 4 lots expired partly unused."

## 3. Tomorrow's batches
For each produced or outsourced item, for the next **open** day:
`batch = median sold on that weekday (last 4 weeks) + small buffer − sellable carryover from today`
- Waste is not subtracted from sales; waste falls because the batch shrinks.
- New **"Sold out"** checkbox on the Daily closeout per item. Sold-out days are excluded and never shrink a batch.
- Rounding: round up when margin is much larger than making cost, round down when the item is costly to make and low-margin.
- Fewer than 3 same-weekday samples → Low confidence. High-waste, low-sales weekdays get a smaller suggestion.

## 4. Menu engineering (Menu Map)
- Compared within category; falls back to the whole menu if a category has fewer than 5 items.
- Popularity = units per open day the item was available (sold-out adjusted); threshold = 70% of the category average.
- Margin = price − recipe cost − waste cost per unit sold; threshold = category median.
- Needs 28+ days listed and a minimum sales count, otherwise "Too new to classify".
- Within 10% of either line → "Borderline", no remove or reprice advice.
- Actions ranked by estimated ₱ impact. Star: promote, protect, never run out. Plowhorse: small price rise, portion/cost cut, bundle. Puzzle: reposition, rename, feature. Dog: reformulate or remove — unless it is the only user of a perishable or shares one (removal warning with that ingredient's expiry rate). High-waste Puzzle may really be a Dog; high-waste Star = production problem.

## 5. Shared rules
- Confidence on every suggestion: **Low** under 7 days of data or open days not confirmed; **Medium** 7–27 days or only 3 same-weekday samples; **High** 28+ days and 4+ same-weekday samples.
- Medians/trimmed values, not plain averages. One-line explanation on every row ("Based on 4 Mondays: median 22 sold, 0 sold out, 3 left over").
- Editable per-café settings with defaults: waste cap 30%, borderline band 10%, eligibility 28 days, category minimum 5, safety buffer 1 open day, history 4 weeks.

## 6. Testing different waste cap options
- **Settings slider** (owner): change the cap (0–50%) and the reorder list recalculates instantly — nothing is saved to purchases.
- **"Compare caps" preview** on the reorder card: for each ingredient, shows the suggested order at 0%, 15%, 30% and 50% side by side, highlighting the current setting. Lets you pick a cap with your café's real numbers before using it.
- **Feedback log:** each suggestion is stored with the cap in use, the action (accepted / edited / ignored) and the outcome (run out? waste qty and ₱). After a few weeks, "Cap 30%: 0 run-outs, ₱X wasted" lets you compare caps tried in different weeks.
- **Automated tests** run the same scenario at several caps and check the reduction never exceeds the cap and only counts avoidable waste.

## 7. Screens and permissions
- Owner Home card "Suggested orders and batches": Reorder list + Tomorrow's batches; status, amount in the ingredient's usual unit, confidence badge, "expiry estimated" / "Open days estimated" tags, explanation, Accept / Edit / Ignore.
- **Mark as ordered** opens the normal Purchase form pre-filled, so it is saved and logged as usual.
- Staff with stock access see the reorder list (no costs). Only owners see costs, margins and menu suggestions.

## Not in this version
Opening hours, sold-out times, opened-vs-sealed shelf life, automatic purchase submission, supplier choice, multi-location.

## Technical details
- Pure, tested modules with no UI/storage: `src/lib/operating-calendar.ts` (isOpen, openDaysBetween, addOpenDays, inferPattern), `src/lib/reorder.ts` (lots, projection, orders, batches), `src/lib/menuEngineering.ts`.
- Weekly pattern reuses existing `workspaces.operating_days`. Closures, confirmed flag, and suggestion settings live in a new synced `cafeSettings` record; feedback in a `suggestionFeedback` collection; both go through `put` so they are audited and work offline. Collections added to the `enforce_record_role` trigger (owner-only writes; staff insert feedback only) — the one small migration.
- Ingredient gains optional `leadTimeDays`, `packSize`, `supplierMinimum`, `deliveryDays`, `defaultShelfLifeDays`; DailyCheck gains optional `soldOut: itemId[]`.
- Reuse compatible-unit conversion and Asia/Manila dates. Existing Menu Map popularity rule (all-time units) stays for the map axis; the new quadrant engine drives the suggestion panel — confirm if you want it to replace the map axis too.
- Unit tests: all cases from the uploaded spec, plus calendar cases (closure inside coverage window, inferred vs confirmed pattern lowers confidence, expiry ticking over closed days) and waste-cap cases at 0/15/30/50%.
- No admin changes.
