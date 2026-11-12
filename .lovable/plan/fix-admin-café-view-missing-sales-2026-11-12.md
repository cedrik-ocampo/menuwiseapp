# Fix: admin café view missing Sales

## What's wrong (confirmed)
This café has 223 sales, 154 waste logs, 92 batches — but also 1,536 change-history entries and 504 usage entries (about 2,550 rows total). The admin café page loads everything in one request, and the database returns at most 1,000 rows per request. The history entries fill that quota, so sales (and possibly waste/production) get cut off and show "No records." and ₱0.

## Fix
- Load the café's records in pages of 1,000 until all are fetched, so nothing is cut off regardless of café size.
- Skip change-history entries in this load (the admin page doesn't display them), which makes it faster.
- Apply the same paging to the Café Monitoring list counts, which has the same 1,000-row ceiling across all cafés.

## Check
- Open this café as admin: Sales tab lists 223 rows; Overview shows a non-zero 30-day sales value; Waste and Production counts match the database.

## Technical details
- `src/lib/admin.functions.ts`: `getCafe` — loop `.range(from, from+999)` ordered by id, `.neq("collection","changeLogs")`; `listCafes` — same paging helper for its record count query.
