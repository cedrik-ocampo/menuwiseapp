# MenuWise: Build Plan

An app for Maginhawa Street cafes and bakeries to track inventory and food waste. On phones it uses a bottom tab bar. On tablet and desktop the same tabs move to a left sidebar. The checklists decide what goes in. The Figma screenshots decide how it looks.

## Look and feel (from the screenshots)
- Navy header showing "Today is {date}." and the café name, with the MW logo on the right.
- Cream page background, white rounded cards, tan secondary buttons and navy primary buttons.
- Amber marks items expiring soon, red marks urgent ones, green marks low waste.
- The uploaded MW logo appears in the header, on the login page and as the app icon.
- Money is always written as a plain "P", for example "P75.00".

## Navigation (follows your 5-tab spec)
- Five tabs in a fixed order: Dashboard, Log Waste, Log Production, Menu Map, Ingredients.
- On phones: a fixed bottom bar. Each tab shows an icon and a label, and the current tab is highlighted.
- At 768px wide and up: a left sidebar with the same 5 tabs.
- The bar is hidden on the Login page and while a full-screen pop-up is open.
- A small amber dot appears on Log Waste or Log Production when offline entries are still waiting to sync.

## Fixed empty-state messages
- "No ongoing insights."
- "No ingredients expiring in {time set}."
- "No waste history yet."

## Pages

### 1. Login
Email and password.

### 2. Dashboard
- Shows "Today is {date}" and the Total Waste Value for the selected period, with an optional breakdown by stage.
- Shows the % change compared with yesterday or last week.
- **Ongoing Insights**
  - Lists ingredients that are close to expiring.
  - A dropdown sets how far ahead to look, in days or weeks. The default is 7 days.
  - Clicking the title or the card background opens the Ingredient Inventory List.
  - Clicking an ingredient row opens that ingredient's page.
- **Menu Map preview**
  - Clicking the title or the card background opens the Menu Map.
  - Clicking a menu item opens that item's page.
- Quick Actions bar with Log Waste and Log Production.

### 3. Log Waste
- **Stage Mapping Table** with 4 columns: Stage where loss happens | What to log | Link to | Where it appears.
  - Raw ingredient in storage | Spoilage, expiry, damage | Ingredient ID | Ingredient Inventory / Individual Ingredient View
  - Prep / WIP | Prep error, spill during prep, burnt batch, wrong drink build | Batch ID + Menu Item ID if known | Individual Menu Item View as attributed/prep waste
  - Finished product | Unsold, day-old, near-expiry, finished drink spilled | Menu Item ID + Batch ID | Individual Menu Item View as direct finished-product waste
- **Guidance lists**
  - In-house pastries: baked croissants that don't sell by end of day are logged as finished-product waste under croissant.
  - Made-to-order drinks:
    - Milk that spoils in the fridge is ingredient waste under milk.
    - A finished latte spilled by the barista is finished-product waste under latte.
    - A wrong espresso shot is WIP/prep waste, linked to latte if possible.
  - Outsourced items: raw ingredients usually aren't tracked. Log the loss as finished-product waste under the menu item.
- **"Avoid Double Counting" callout box**
  - If a finished croissant is discarded, don't also log its flour, butter and sugar as wasted.
  - If raw butter spoils, don't also log the equivalent croissants as wasted.
  - Log each loss once, at the stage where it happened.
- **Form fields**
  - Date and time, and stage (Ingredient / WIP / Finished Product).
  - The item the loss is linked to (ingredient, menu item or batch). The choices change with the stage.
  - Waste type: Spoilage, Expiry, Spill, Prep Error, Unsold or Day-old.
  - Quantity and unit, and unit cost.
  - Waste value, which is filled in automatically.
  - Optional: the menu item the loss is attributed to, and the allocation method (Direct / Batch-linked / Recipe-based / Manual).
- **How waste value is worked out** (always based on cost)
  - Raw ingredient: quantity × purchase unit cost.
  - Finished product: standard recipe cost, or batch cost ÷ yield.
  - Outsourced item: purchase cost per unit.
  - Retail value lost can be shown as extra information.

### 4. Log Production
- Pick an existing menu item, then enter the quantity and the batch expiry date.
- Saving updates the item's amount produced this week and its average weekly production.
- Each entry links to the menu item's page.
- Includes a "Create new menu item" link.

### 5. Menu Map
- Menu items are sorted into Stars, Plowhorses, Puzzles and Dogs. Color runs from red (high waste) to green (low waste).
- Shown as a bubble chart, with a table view you can switch to. The table orders each group from highest to lowest waste.
- **Waste measure**
  - Uses direct finished-product waste by default.
  - A toggle adds prep/WIP waste that is linked to each item.
  - Ingredient waste that isn't linked to a menu item is never counted.
- Every item opens its own page when clicked.
- "+ Add Menu Item" and "Quick add batch" (which opens Log Production).

### 6. Add New Menu Item
- **Layout**
  - Breadcrumb: "Menu Overview > Add New Menu Item".
  - Step indicator: 1 Basic Info | 2 Type & Cost | 3 Recipe | 4 Production & Waste Defaults, then a Review card.
- **Step 1, Basic Info:** ID (filled in automatically or typed), name, category, subcategory, description, image, "Available for Sale" toggle and tags.
- **Step 2, Type & Cost:** choose Made-to-order, In-house or Outsourced.
  - Made-to-order and In-house fields:
    - Batch cost, yield and retail price.
    - Cost per unit, standard recipe cost, margin and food cost %, which are calculated for you.
    - Shelf life and the default expiry rule.
  - Outsourced fields: purchase cost per unit, unit, retail price, supplier and shelf life.
- **Step 3, Recipe**
  - Table columns: ingredient, quantity, unit, unit cost, line cost, % of recipe cost, allocation method, and remove.
  - Search for an existing ingredient, or choose "+ Create new ingredient", which opens a side drawer.
  - Totals: total recipe cost, batch cost, cost per unit and yield.
  - Outsourced items skip this step and show a short note explaining why.
- **Step 4, Production & Waste Defaults**
  - Default batch size and unit, and the default expiry after production.
  - Default waste stage and type, and the "Allow Quick Add Batch" toggle.
  - Starting figures for amount produced this week, average weekly production and average weekly sales.
- **Summary card:** stays on the right on desktop and sits below the form on phones.
- **Buttons:** Cancel | Back | Next | Save | Save & Add Another.
- **Checks before saving:** each one shows a clear message next to its field.
  - Menu Item ID is filled in and not already used.
  - Name, category and type are filled in.
  - Retail price and every cost are 0 or more.
  - Yield is more than 0 for Made-to-order and In-house items.
  - Every recipe row has an ingredient and a quantity above 0.
  - Shelf life is filled in.
  - Any further rules listed in the checklist are added as well.
- **After saving:** Save opens the new item's page. Save & Add Another clears the form for the next item.

### 7. Individual Menu Item View
- Amount produced this week, average weekly production and average weekly sales.
- The expiry date for each batch.
- Quick-add batch.
- A simple way to enter sales.
- **Waste history** (newest first)
  1. Direct finished-product waste, the main list, for example "9/27/26, Spill, 3 pieces, P297.00".
  2. Prep/WIP waste linked to this item, for example "9/28/26, Prep error, 1 batch, P150.00".
  3. Total, clearly labeled as including linked prep/WIP waste.
- **Guidance notes**
  - Pastries:
    - Finished-product waste means unsold, day-old or near-expiry items.
    - Ingredient waste is recorded on the ingredient's page.
    - Prep/WIP waste shows here when it's linked to this item or one of its batches.
  - Drinks:
    - Finished-product waste means a spilled or wrong finished drink, or one left unsold.
    - Ingredient waste is recorded on the ingredient's page.
    - Prep/WIP waste shows here when it's linked.
- Log waste directly from this page.

### 8. Ingredient Inventory List
- Sort by expiry (the default, soonest first), purchase date, last used, or name.
- Counters for ingredients in stock and ingredients expiring in 3 days.
- **Ingredient history:** a section listing recent purchases, uses and waste across all ingredients, newest first.
- Buttons for Manual Input, Excel import and Google Sheets import.
- Clicking a row opens that ingredient's page.

### 9. Manual Ingredient Input
- Breadcrumb: "Ingredient Inventory > Manual Input".
- Fields follow the screenshot.
- **Checks before saving**
  - Ingredient ID is filled in and not already used.
  - Name and unit are filled in.
  - Quantity is more than 0, and unit cost is 0 or more.
  - Purchase date is filled in, and the expiry date is on or after the purchase date.
- **Where it opens and where it goes after saving**
  - As its own page: after saving, it opens the new ingredient's page.
  - From the Recipe step: it opens as a side drawer. After saving, it closes and fills the new ingredient into that recipe row.

### 10. Individual Ingredient View
- **Current stock:** purchase date, expiry, quantity and stock value.
- **Next expiry:** for example, "Batch purchased on 10/4/26 will expire in 5 days from now (10/9/26)".
- Repurpose tips appear when a large amount is close to expiring.
- **Purchasing**
  - Last purchase, for example "Last purchased 5 days ago (9/29/26)".
  - Average time between purchases.
  - A "Recommended next purchase" pop-up.
- **Menu usage:** how many menu items use this ingredient, and a pie chart of each item's share.
- **Waste history:** ingredient waste only, newest first, with a button to log more. For example: "10/2/26, Spoilage, 350 ml, P75.00".

## Out of scope (locked)
Plate waste, POS integration, report exports, waste-alert pop-ups, the paper's formulas and auto-recommendations, barcode scanning, and conflict-review screens.

## Data and offline
- Lovable Cloud handles sign-in and keeps an online copy of everything.
- The app works offline. Entries are saved on the device and sync once you're back online. If one record is changed in two places, the latest change wins.
- It can be installed on a phone like an app. Offline mode is switched off inside the Lovable preview, so test it on the published site.
- Comes with sample data for The Dawn Cafe so every page has something to show.

## Technical details
- Routes: `/login`, `/` (dashboard), `/log-waste`, `/log-production`, `/menu`, `/menu/new`, `/menu/$id`, `/ingredients`, `/ingredients/new`, `/ingredients/$id`. Protected pages sit under an authenticated layout.
- Tables: ingredients, ingredient_purchases, menu_items, recipe_lines, batches, sales_entries, waste_logs.
  - Every row has `updated_at` for Last-Write-Wins.
  - RLS limits each row to its owner.
  - Seed rows are inserted in the migration.
- The ingredient form is one shared component, shown either as a page or inside a Sheet drawer. When used in the drawer, it reports the new ingredient back to the recipe row through an `onSaved` callback.
- Forms are validated with zod. A shared `formatPeso` helper prints amounts as "P75.00".
- Offline uses an IndexedDB outbox (idb) and a sync loop that runs on reconnect. The service worker is skipped in iframes and on preview hosts.
- Charts use Recharts and icons use Lucide. Color tokens are oklch values in styles.css.
