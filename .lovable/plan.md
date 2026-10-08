# MenuWise — Team Revision Round

## 1. Menu Map tab
- View switcher moves above the white card; order: **Bubble Chart (default) | Table | Inventory**.
- New **Production History** section below the chart: every batch logged (item, quantity, date, who logged it), newest first, with Edit and an "Edited by {name} on {date}" caption.

## 2. Dashboard
- Each Ongoing Insight card opens that exact ingredient page; the section title opens the full Ingredients list.
- Quick Actions: big primary row (Log Waste / Log Production) + smaller secondary row (Add Menu Item / Add Ingredient). Keeps rush-hour actions one tap away.

## 3. Ingredients tab
- Buttons become **Manual Input** and **Import**. Import opens a small menu: Excel (.xlsx), CSV, Google Sheets (marked "coming soon" unless connected later).
- Helper text: "Required Columns: Ingredient_ID, Ingredient_Name, category, unit, quantity, unitCost, purchaseDate, expiryDate."
- Import preview screen before saving: categories are trimmed, case-matched to existing ones, and unknown ones flagged in amber (user can keep as new or pick an existing one). Rows with errors are listed and skipped.
- Manual Input: Category required; Storage optional.

## 4. Add New Menu Item
- **Import** button (Excel/CSV) with the same preview + category normalization. Log Production also gets Import (columns: Menu_Item, quantity, producedAt, expiryDate).
- Remove asterisks; required fields marked like the ingredient form (a subtle "Required" hint next to the label).
- Rename "Viennoiserie" to **"Croissants & Danishes"** (plain and matches the other subcategories). Existing items are relabeled.
- Tags optional.

## 5. Individual Ingredient View
- Stage shown as a single line: "Stage: Ingredient". Helper text removed.

## 6. Insight responses
- Each insight card gets small icon+label buttons: **Accept** (check), **Maybe** (clock), **Reject** (x).
- Accept: hides the insight and records it in a short "Actioned insights" list at the bottom of the section.
- Reject: hides it permanently for that lot.
- Maybe: small pop-up with 24 hours (default) / 3 days / 1 week, then a toast "Snoozed until {date}". It reappears automatically after that time.
- Responses are shared with the whole team.

## 7. Team sharing (workspaces)
- Every account belongs to a café workspace; the café name becomes the workspace name.
- New **Team** page (people icon in the header): owner invites by email, sees members, can remove them.
- Invitee signs up/logs in with that email and is automatically joined to the café on sign-in (no email sending needed; the owner tells staff to sign up). A pending invite list shows who hasn't joined yet.
- All data (ingredients, menu, logs) is shared within the workspace. Existing data is moved into each user's own new workspace, so nothing is lost.
- Roles: Owner (manage team) and Staff (everything else).

## 8. Edit + change log
- Edit buttons on waste log rows, production rows and ingredient purchase entries (reuse the same forms, prefilled).
- Every create/edit records who and when; rows show "Logged by {name} on {date}" and, if edited, "Edited by {name} on {date}" with an expandable list of what changed (field: old → new).
- Shown in Production History (Menu Map), Menu Item waste history, Ingredient waste history.

## Technical details
- DB migration: `workspaces`, `workspace_members` (role enum, security-definer `is_workspace_member`), `workspace_invites`, `change_logs` (workspace_id, collection, record_id, user_id, user_name, changes jsonb, at). Add `workspace_id` to `records` (nullable, backfilled per user), unique key becomes (workspace_id, collection, id); RLS switches from user_id to membership. Grants on all new tables.
- Sign-in trigger/server fn: create personal workspace if none; accept pending invites matching the user's email.
- Store: IndexedDB keyed by workspace; records carry `createdBy`, `updatedBy`, `updatedByName`; edits append a change_log entry (queued offline, synced LWW like records). Insight responses stored as a new `insightResponses` collection.
- Import: parse .xlsx with SheetJS and CSV client-side; shared `normalizeCategory` helper.
- Subcategory rename applied in options list and mapped on read for old values.
