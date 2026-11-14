# Plan: "Enter as needed" waste logging (no full menu required)

Goal: a café can log waste for any item by typing its name, even if it is not in Menu Items or Ingredients. Waste totals stay accurate, and owners can optionally turn a typed item into a real menu item later.

## Where each piece goes

| Piece | Location | Who sees it |
|---|---|---|
| Type-or-pick item box | Log Waste page, Waste Log Form (replaces the item/ingredient dropdown) | Owner, staff, admin |
| Suggestion list (menu items + ingredients + previously typed names) | Same box, drops down while typing | Everyone logging |
| Auto-filled unit and unit cost | Same form, filled from the last log of that name (still editable) | Everyone logging |
| "Custom" tag on entries | Recent waste logs list, Staff Home activity, Home waste cards | Everyone |
| "+ Add to Menu" button | Recent waste logs list, on custom entries only | Owner and admin only |
| Pre-filled "Add to Menu" window | Opens from that button (name, unit, cost filled; price and category optional) | Owner and admin |
| Waste import | Waste import review accepts unknown names as custom instead of an error | Everyone who imports |
| Totals and charts | Home Total Waste Value, waste-by-stage, top waste incidents include custom entries | Owner |

## How it behaves

1. Barista starts typing "Ube cake". Suggestions show matches grouped as Menu item / Ingredient / Previously logged.
2. Picking a catalog item works exactly like today (linked to the item, cost from recipe).
3. Typing a new name saves it as a custom entry with the quantity, unit and cost the barista enters. Next time it appears under "Previously logged" with the last unit and cost filled in.
4. Names are matched ignoring capital letters and extra spaces, so "ube cake" and "Ube Cake " are the same item.
5. Owner clicks "+ Add to Menu" on a custom entry, confirms the pre-filled details, and the new menu item is created. Past custom logs with that name are linked to it so its history shows on the item page. Fully optional.

## What does not change

- Sales, Production and Menu Map still use catalog items only.
- Staff permissions stay the same (staff add logs, edit only their own latest one; only owners/admins see "+ Add to Menu").
- Existing waste logs are untouched.

## Technical details

- `WasteLog` gains optional `customName?: string` (used when no `menuItemId`/`ingredientId`). No database change: logs live in the existing `records` JSON.
- New browser-safe helper `src/lib/waste-suggestions.ts`: builds the grouped suggestion list and "last unit/cost by normalized name"; unit tests alongside.
- `WasteLogForm.tsx`: replace the item select with a combobox (shadcn Command/Popover) using the helper.
- `WasteList`, `shift-dashboard.ts`, `calc.ts` waste summaries: display `customName` when no linked item; totals already sum `value`, so they include custom entries.
- `import-parsers.ts` waste parser: unmatched names become `customName` with a review note; duplicate key uses `customName` too.
- "+ Add to Menu": reuses the menu item quick-add path (`put` on `menuItems`, audited), then relinks matching custom logs via `put` (owner/admin only, allowed by `enforce_record_role`).
- Record the rule in AGENTS.md: waste logs may reference a free-text `customName` instead of a catalog item.
