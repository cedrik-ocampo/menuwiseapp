# Simplify Add New Menu Item and Recipe Costing

## Goal
Make **Menu Overview > Add New Menu Item** easier for café owners to understand, while calculating item cost directly from Ingredient Inventory and supporting recipe-based spreadsheet imports.

## Form flow
Replace the five-step setup with four focused steps:

1. **Basic Info**
   - Menu Item Name
   - Category and Subcategory
   - Optional image and tags
   - Selling Price per piece
2. **Costing & Recipe**
3. **Review**
4. Save the item or save and add another

Remove the entire **Production & Waste Defaults** step. MenuWise will save safe internal defaults so production and waste logging continue to work without asking the user to configure them here.

MenuWise will also generate and hide the internal Menu Item ID during manual setup. The recipe is attached directly to the item being created, so café owners will not enter or see an ID field.

## Clear item types and costing
Show these clearer labels while preserving compatibility with existing saved items:

- **Individual item**: require a recipe for one drink/item; cost per item is the sum of its ingredient costs.
- **Batch-made item**: require a batch recipe and batch yield; cost per piece is total batch ingredient cost divided by yield. This computed amount is also the basis for WIP waste per piece.
- **Outsourced item**: require batch purchase price and pieces per purchased batch; cost per piece is purchase price divided by quantity.

Selling price remains a required basic-information field. Computed item cost, margin, and food-cost percentage appear in the review rather than crowding recipe entry.

## Recipe input redesign
Replace the wide table with a compact, setup-focused editor:

- Search and select by **ingredient name**, not ID; retain an option to create a missing ingredient.
- Each recipe line shows ingredient name search, amount, unit dropdown, computed **Ingredient Cost**, and remove control.
- Rename “Line Cost” to **Ingredient Cost** and add a question-mark help pop-up explaining: “The cost of the amount used in this recipe, based on the ingredient’s saved unit cost.”
- Remove ingredient ID, recipe-share percentage, and allocation method from recipe setup.
- Use a unit dropdown with compatible conversions, such as kg/g and L/ml. Piece, pack, and box units remain selectable only where their saved ingredient unit makes the calculation meaningful.
- Show only the useful totals below the recipe: total recipe/batch cost, yield where applicable, and computed cost per item.
- Require at least one complete recipe line for Individual and Batch-made items; Outsourced items skip recipes.

Existing recipes with allocation values remain readable and keep their stored value, but new recipe lines use the standard recipe-based value automatically.

## One-row-per-ingredient import
Update the downloadable menu-item template and importer so repeated Menu Item IDs are grouped into one item and recipe.

The spreadsheet keeps a short **Item Code** only because several ingredient rows need a reliable grouping key. It is an import helper, not a field shown during manual item creation. MenuWise converts it to the item’s internal ID when imported.

Example:

| Menu Item ID | Name | Type | Selling Price | Batch Yield | Ingredient Name | Amount | Unit |
|---|---|---|---:|---:|---|---:|---|
| MI-001 | Chocolate Croissant | Batch-made item | 120 | 12 | Flour | 500 | g |
| MI-001 | Chocolate Croissant | Batch-made item | 120 | 12 | Butter | 250 | g |
| MI-001 | Chocolate Croissant | Batch-made item | 120 | 12 | Chocolate | 180 | g |

Import behavior:
- Group rows sharing the same Menu Item ID into one recipe.
- Accept the spreadsheet heading **Item Code** instead of exposing the technical “Menu Item ID” wording.
- Match recipe ingredients by name, case-insensitively, against Ingredient Inventory.
- Require recipe rows for Individual and Batch-made items.
- Allow one row with no recipe ingredient for Outsourced items, using batch purchase price and pieces per batch.
- Reject unmatched or ambiguous ingredient names, invalid amounts/units, duplicate ingredient lines, inconsistent repeated item details, missing yields, and duplicate Menu Item IDs already in MenuWise.
- Preview results by menu item, with clear row-specific errors before anything is saved.

## Existing screens and calculations
- Update the individual menu-item recipe display to use **Ingredient Cost** and remove the allocation column from the owner-facing table.
- Keep existing menu items working by mapping their stored types to the clearer labels and deriving sensible values from their current costing fields.
- Use the same unit-conversion and cost calculation in manual setup, imports, the review summary, Menu Map profitability, and the individual item page.

## Validation
- Test all three costing paths with realistic ingredient units and prices.
- Test compatible and incompatible unit selections.
- Test a multi-row batch-made import, an individual-item import, and an outsourced import.
- Confirm non-outsourced items cannot save or import without a recipe.
- Confirm production and waste logging still work with the hidden internal defaults.
- Check the form and recipe editor on desktop and mobile, then run the relevant automated tests and confirm the preview builds cleanly.
