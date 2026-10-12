# Reorder and Separate Main Navigation Tabs

## Goal
Arrange the café workflow from setup through daily operations and reporting:

1. Home
2. Ingredients
3. Menu Items
4. Menu Map
5. Log Production
6. Log Waste
7. Sales

## Navigation changes
- Rename the desktop **Dashboard** label to **Home**.
- Add separate **Menu Items** and **Menu Map** navigation entries.
- Keep the existing item detail and add-item links working.
- Update tab positions and accessibility labels to say “of 7.”
- Show all seven phone tabs in a horizontally scrollable bottom bar, preserving this exact order and a clear active state.

## Separate menu views
- **Menu Items** will open the catalog-focused view for adding, finding, and reviewing items.
- **Menu Map** will open the chart and analysis views for menu engineering.
- Preserve item-name navigation between Menu Map analysis and the corresponding menu item.
- Use distinct page headings and metadata for each view while keeping existing item records and calculations unchanged.

## Subcategory selection
- Start new menu items with **Subcategory** set to an explicit **Unselected** option instead of automatically choosing the category's first subcategory.
- Reset Subcategory to **Unselected** when the main category changes, so the owner makes a deliberate choice.
- Allow **Unselected** as a valid saved state and display the item under its main category without assigning a false subcategory.
- Keep Subcategory optional in file imports; blank values remain unselected instead of defaulting to the first available subcategory.

## Validation
- Verify the order and active tab on desktop and phone layouts.
- Verify horizontal phone scrolling and that labels remain readable.
- Test navigation to Home, Ingredients, Menu Items, Menu Map, Log Production, Log Waste, and Sales.
- Confirm add-item, item-detail, Menu Map analysis, and back-navigation flows still work.
- Confirm manual creation and file import preserve an unselected subcategory without silently categorizing the item.
- Run relevant navigation tests and confirm the preview builds cleanly.
