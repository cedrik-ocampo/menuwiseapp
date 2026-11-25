# Café Monitoring analytics enhancement

## What changes

- Add one reporting-period control to each café's admin dashboard: This Week through 7 Weeks Ago, Last 30 Days, and a custom range. Use Monday–Sunday weeks and Asia/Manila date boundaries, show the exact range and partial-period status, and keep the selection while switching tabs.
- Add an optional equivalent-period comparison. Return current, previous, absolute change, relative or percentage-point change, and KPI-specific interpretation; never treat every increase as an improvement.
- Replace fixed 30-day calculations with a server-side analytics projection driven by the selected period. Continue returning only approved aggregates, never raw café transactions or financial values.
- Expand Overview with waste-to-sales ratio, unit-compatible waste rates, sales volume, separate logging coverage, sell-through, and reconciliation availability.
- Expand Waste with daily/weekly/monthly trend options, current and previous series, stage value shares, and reason value shares. Keep all peso amounts server-side.
- Add Inventory Performance using purchases, usages, production, sales, and waste. Treat outsourced production entries as supplier receipts. Group unit-compatible results instead of adding incompatible units.
- Make Menu Map counts respond to the selected period and require enough classified items and valid costing; otherwise show an insufficient-data state.
- Add Data Quality, Usage, Research Insights, and Data Limitations sections. Identify unsupported sync failure/conflict counts and independent stock-count reconciliation as unavailable rather than inventing values.
- Keep Menu Setup, Ingredient Costing, Team & Invitations static. Show selected-period and all-time production counts separately.

## Missing data added carefully

- Add café owner settings for expected operating days and explicit research-reporting consent. Research consent defaults to off and does not block operational admin monitoring.
- Add a daily-check record so a team member can explicitly confirm “no waste today” and complete a daily closeout. Existing waste entries continue to count as waste checks; empty days are not assumed waste-free.
- Reuse the existing workspace-scoped records store and permissions. Do not add KPI imports, duplicate transactions, or mock results.

## Privacy and security

- Keep raw-record admin RLS disabled. The authenticated server function verifies the admin role, performs aggregation with the privileged server client, and returns only the privacy-safe DTO.
- Exclude item names, prices, costs, recipes, individual sales, supplier purchases, exact margins, and employee-level activity from the response.
- Aggregate time series and suppress breakdown groups representing fewer than three records. Hash catalog IDs as before.

## Validation

- Add independent tests for Manila week boundaries, partial-week comparisons, custom/previous ranges, ratio and percentage-point changes, missing-data handling, unit compatibility, reason/stage shares, no-waste confirmation, and response redaction.
- Run the full test suite and typecheck, inspect build output, then exercise the admin dashboard in the browser with the admin account.
