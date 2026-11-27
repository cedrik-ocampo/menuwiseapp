# Edit recipe on the menu item page

## What changes
- Add an "Edit recipe" button (owners only) to the Recipe section on the individual menu item page.
- Clicking it turns the table into an editor:
  - Ingredient: pick by name from the café's ingredients (searchable dropdown).
  - Amount: number field.
  - Unit: dropdown limited to units compatible with that ingredient's saved unit (g/kg, ml/L, pc).
  - Add ingredient row / remove row buttons.
  - For batch-made items, also edit the batch yield ("makes N").
- Ingredient Cost and Recipe Share stay calculated, not typed: they update live as you change amount/unit, so the numbers can't drift from real purchase prices. To change an ingredient's cost, edit its purchase price on the Ingredients page (a link is shown next to each row).
- Cancel (and Escape) leaves without saving; Save validates (no blank ingredient, amount > 0, no duplicate ingredient, compatible unit) and saves.
- Cost per piece in the header and Menu Map margins update automatically after saving.
- Outsourced items: instead of a recipe, allow editing purchase price per batch and pieces per batch.

## Technical details
- New `RecipeEditor` component in `src/components/mw/`, used from `src/routes/_authenticated/menu.$id.tsx`.
- Saves through the existing `put("menuItems", …)` so audit fields and change logs are recorded; recipe keeps ingredient IDs internally.
- Live cost via existing `ingredientAmountCost`; unit compatibility via existing menu-costing conversion helpers.
- Gate with `perm.isOwner` (and admin edit mode), matching existing menu edit rules.
- Add a small test for the save validation rules.
