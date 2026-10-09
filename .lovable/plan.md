# Team revision round 2

## 1. Menu Map bubble chart
- Verify quadrant logic: high popularity + high margin = Stars (top right), high popularity + low margin = Plowhorses (bottom right), low popularity + high margin = Puzzles (top left), low + low = Dogs (bottom left). Fix any mismatch in the calculation.
- Draw faint quadrant labels in each corner of the chart.
- Replace the caption under the chart with two clean centered lines:
  - "Lower waste [gradient] Higher waste · Bubble size = waste value"
  - "Top right: Stars · Bottom right: Plowhorses · Top left: Puzzles · Bottom left: Dogs"

## 2. "Logged by / Edited by" everywhere
- Add the shared Logged/Edited caption (with tap-to-see changes) to: ingredient rows (list and grid pop-up), Log Waste history rows, Ingredient View waste history, Menu Item View waste history.
- Every change already goes into the shared change log; confirm ingredient edits from the grid pop-up and menu item edits go through the same path.

## 3. Log Production tabs
- Two-tab switch at the top: "Log Production" | "Add Menu Items". The second tab opens the Add New Menu Item page (keeps the same tab bar visible there so you can switch back). Navy/cream styling, same as other switches.

## 4. Actionable insights
- Each insight card gets a suggestion line under the ingredient name, chosen by category/name: milk, bread/pastries, berries, eggs, cheese, vegetables, coffee/matcha (team's exact wording). Fallback "Use up first."

## 5. Import validation (Ingredients, Menu Items, Production)
- Before upload: "Required Columns: ..." in the same format on all three.
- On upload: if columns missing, block with "Cannot import — missing required columns: x, y."
- Row errors listed as "Row N: reason" (incl. expiry before purchase date).
- "Download template" button producing a CSV with the correct headers.

## 6. Quick action visual
- Give "Add Menu Item" / "Add Ingredient" proper padding, rounded corners, border and hover so they match the top row's weight (smaller size kept).

## 7. Storage optional
- Confirm no "Required" tag and no error when Storage is empty; fix if found.

## 8. Consistency pass
- Buttons: navy primary, tan secondary everywhere.
- No asterisks; one "Required" tag style on all forms.
- Same required-columns message on all imports; Edited-by caption on all log lists.
- Browser check of each page afterward, then a summary of choices.
