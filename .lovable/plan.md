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

## Validation
- Verify the order and active tab on desktop and phone layouts.
- Verify horizontal phone scrolling and that labels remain readable.
- Test navigation to Home, Ingredients, Menu Items, Menu Map, Log Production, Log Waste, and Sales.
- Confirm add-item, item-detail, Menu Map analysis, and back-navigation flows still work.
- Run relevant navigation tests and confirm the preview builds cleanly.
