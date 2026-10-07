# MenuWise: Build Plan

An app for Maginhawa Street cafes and bakeries to track inventory and food waste. It works on phones (bottom tab bar) and adapts to tablet and desktop (left sidebar). The checklists decide what goes in. The Figma screenshots decide how it looks.

## Look and feel (from the screenshots)
- Navy header with "Today is {date}." and the café name, plus the MW logo on the right.
- Cream page background, white rounded cards, tan secondary buttons, navy primary buttons.
- Amber for items expiring soon, red for urgent ones, green for low waste.
- The uploaded MW logo is used in the header, on the login page and as the app icon.

## Navigation (follows your 5-tab spec)
- Dashboard, Log Waste, Log Production, Menu Map, Ingredients. Order is locked.
- Phone: fixed bottom bar with an icon and label on each tab, and a clear active state.
- 768px and wider: a left sidebar with the same 5 tabs.
- Hidden on Login and while full-screen pop-ups are open.
- A small amber dot on Log Waste or Log Production when there are offline entries still waiting to sync.

## Pages
1. **Login**: email and password.
2. **Dashboard**
   - Shows Total Waste Value (₱) for the selected period, with an optional breakdown by stage.
   - Shows the % change compared with yesterday or last week.
   - Ongoing Insights: ingredients expiring within a chosen window (days or weeks, default 7 days). If none, it says so.
   - A small summary of the Menu Map.
   - Quick Actions bar: Log Waste, Log Production.
3. **Log Waste**
   - Stage: Ingredient / WIP / Finished Product.
   - The item you link to depends on the stage: an ingredient, a batch, or a menu item.
   - Other fields: waste type (Spoilage, Expiry, Spill, Prep Error, Unsold, Day-old), quantity and unit, and unit cost.
   - Waste value is calculated automatically from cost, never from the selling price.
   - Optional fields: attributed menu item and allocation method.
   - A note reminds staff not to count the same loss twice.
4. **Log Production**
   - Pick an existing menu item, then enter quantity and batch expiry date.
   - Updates the menu item's weekly totals.
   - Includes a "Create new menu item" link.
5. **Menu Map**
   - Four groups: Stars, Plowhorses, Puzzles and Dogs. Each item is shaded red (high waste) to green (low waste).
   - Shown as a bubble chart, with a table view to switch to.
   - Ranked by direct finished-product waste by default. A toggle adds prep/WIP waste that is linked to the item.
   - Includes "+ Add Menu Item" and a quick-add batch button.
6. **Add New Menu Item**: a 4-step form.
   - Basic Info → Type & Cost (Made-to-order / In-house / Outsourced) → Recipe → Production & Waste Defaults.
   - Ends with a review card.
   - A summary card stays on the right on desktop.
   - Calculates cost per unit, margin and food cost % for you.
7. **Individual Menu Item View**
   - Amount produced this week, average weekly production and average weekly sales.
   - Expiry date for each batch, and a quick-add batch button.
   - Waste history in 3 sections: direct waste, attributed prep/WIP waste, and total (labeled).
8. **Ingredient Inventory List**
   - Sort by expiry (default, soonest first), purchase date, last used, or name.
   - Shows counts for ingredients in stock and expiring in 3 days.
   - Includes a Manual Input button. Excel and Google Sheets import buttons are included as described in the checklist.
9. **Add Ingredient (Manual Input)**: form matching the screenshot.
10. **Individual Ingredient View**
    - Current stock: purchase date, expiry, quantity and stock value.
    - Next expiry message, last purchase date and average time between purchases.
    - "Recommended next purchase" pop-up, plus repurpose tips when a large amount is close to expiring.
    - Pie chart of how much of the stock each menu item uses.
    - Ingredient waste history (newest first) and a button to log waste.

## Out of scope (locked)
Plate waste, POS integration, report exports, waste-alert pop-ups, the paper's formulas and auto-recommendations, barcode scanning, and conflict-review screens.

## Data and offline
- Lovable Cloud handles sign-in and stores everything online.
- The app also works offline. Entries save on the device and sync when you're back online. If the same record was changed in two places, the most recent change wins.
- It can be installed on a phone like an app. Offline mode is turned off inside the Lovable preview, so test it on the published site.
- Starts with sample data for The Dawn Cafe (ingredients, menu items, batches and waste logs) so every page has something to show.

## Technical details
- TanStack routes: `/login`, `/` (dashboard), `/log-waste`, `/log-production`, `/menu`, `/menu/new`, `/menu/$id`, `/ingredients`, `/ingredients/new`, `/ingredients/$id`. Protected pages sit under an authenticated layout.
- Tables: ingredients, ingredient_purchases, menu_items, recipe_lines, batches, sales_entries, waste_logs. Each row stores `updated_at` for Last-Write-Wins, and RLS limits each row to its owner.
- Offline: an IndexedDB outbox (idb) with a sync loop that runs when the device reconnects. The service worker is skipped in iframes and preview hosts.
- Charts: Recharts. Icons: Lucide. Tokens are in oklch in styles.css.
- Average Weekly Sales come from manual sales entries on the menu item page.
