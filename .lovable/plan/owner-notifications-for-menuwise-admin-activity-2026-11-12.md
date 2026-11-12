# Owner notifications for MenuWise admin activity

## Today
Admin quick-adds, imports, catalog edits and "Work in this café" changes are already saved as **Admin edit** entries in the café's change history. Owners only see them inside each record's history, though, and nothing alerts them. When an admin views a café's numbers, nothing is recorded at all.

## What to build
1. **Bell icon beside the profile menu** for owners and staff. A red badge shows the number of unread notifications.
2. **Notification list** (opens when the bell is clicked), newest first. Each entry shows:
   - "MenuWise Admin added 12 menu items" / "edited Iced Latte: price ₱120 → ₱130" / "viewed your café's records"
   - Date, time, and the admin's note, if they left one
   - A link to the item when there is one
   - A "Mark all as read" button
3. **Record admin views**: opening a café in Café Monitoring adds one "viewed" entry for that café, at most once per day, so the list isn't flooded.
4. Imports done on a café's behalf show as **one grouped entry** ("Imported 25 menu items"), not one entry per item.
5. Read/unread status is saved per owner on each device, so the list works offline like the rest of the app.

Staff see the same bell and list, so the whole team knows when MenuWise changed the menu. Roadmap: add this task to roadmap.md when building.

## Technical details
- New `NotificationBell` component next to `<UserMenu />` in `AppShell.tsx`. It reads `db.changeLogs.filter(c => c.adminEdit)` from the synced store.
- Unread status uses a last-seen timestamp in localStorage under a key based on the user and workspace.
- `getCafe` in `admin.functions.ts` writes a `changeLogs` record `{ action: "viewed", adminEdit: true }` with the ID `view-<ws>-<yyyy-mm-dd>` (an upsert, which keeps it to one per day). The admin's personal log ignores "viewed" entries.
- `adminSaveMenuItems` adds a `batchId` to its logs so the bell can group an import into one entry.
- Add a small test for grouping and unread counting.
