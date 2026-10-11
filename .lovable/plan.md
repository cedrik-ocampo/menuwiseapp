# MenuWise Checklist 3 revision plan

## Goal
Implement the new capstone checklist in four gated phases while preserving the empty-café experience, offline-first records, workspace sharing, audit history, and existing Dashboard week selectors. Complete and verify each phase, report its result, and wait for confirmation before starting the next phase.

## Phase order
1. **Phase 1:** Business Profile, invitations, account safety, guidance, release notes, help, and contact.
2. **Phase 2:** Menu engineering correction, Production/Waste imports and forms, recipes, and ingredient usage.
3. **Phase 3:** Progressive Sales line chart.
4. **Phase 4:** Read-only MenuWise admin account and café monitoring.

## Phase 4 — Secure, read-only MenuWise admin monitoring
- Add a protected backend `admin` role, assigned to `menuwise.contact@gmail.com`; never infer admin access from browser storage or editable account details.
- Add an admin-only **Café Monitoring** page listing every café, its owner, member count, record activity, sync recency, and progress/usage counts.
- Let an admin open any café in the familiar MenuWise layout. The café opens read-only with a persistent “Viewing as MenuWise admin” banner.
- Admins can view all café records, members, and pending invitations but cannot add, edit, delete, invite, or otherwise change anything.
- Add an admin café-member view showing owners, staff, and pending invitations.
- Keep all cross-café reads and writes protected by backend role checks and database policies; ordinary owners and staff remain restricted to their own café.
- Add “Admin edit mode” to future enhancements rather than implementing it now.

## Phase 1 — Business Profile, invitations, and account safety
- Rename the Profile page’s **Workspace** section to **Business Profile**.
- Show pending invitations, including email, sender/date, and a cancel action for the café owner.
- Replace the current browser-only invite insert with a protected owner action that stores the pending invite and sends a sign-up invitation when email delivery succeeds. The pending invite remains visible if delivery fails, with a clear retry state.
- Use the invitation message: “You have been invited to join MenuWise Analytics for {Café Name}.” Existing users continue to join their invited café at sign-in.
- Add inactivity protection: after **30 minutes** without keyboard, pointer, touch, or navigation activity, sign out and require login again. Show a short warning before timeout and preserve unsynced offline records locally.
- Add **Confirm password** to account creation, validate that both entries match before signup, and keep the existing email-confirmation step.
- Update signed-in password changes to require the current password as well as matching new-password fields.

## Phase 2A — Menu engineering correction and interaction
- Change popularity from 30-day average weekly sales to **all-time total units sold per menu item**. Rename the X-axis, tooltips, captions, table values, and menu-item KPI so the metric is unambiguous.
- Keep profitability based on unit margin, but add **Margin %** beside **Sales Volume** in the Analysis view.
- Make the bubble plot a stable 1:1 square on every screen, with responsive scrolling/containment where needed.
- Rename Menu Map views to **Bubble Chart**, **Analysis**, and **Menu Catalog**.
- Clicking a bubble switches to Analysis, expands its quadrant if needed, scrolls to the row, and visibly highlights that item.
- Clicking an item name in Analysis navigates to the existing Individual Menu Item View. No new modal or catalog card is introduced for this action.
- Format each quadrant summary with item count, highest-waste item/value, and lowest-waste item/value. Initially show a concise subset and add **View all {n} items** / collapse controls.
- Preserve zero-sales items in Menu Catalog and the existing “not yet classified” treatment, but do not plot them or include them in quadrant medians.

## Phase 2B — Production and waste imports/forms
- Production form starts with **Select a menu item** instead of preselecting the first item.
- Move **+ Create new menu item** below the Production Log Form so it does not flatten the heading/action row.
- Keep production import columns exactly: `Menu_Item_ID`, `quantity`, `producedAt`, `expiryDate`, with `Batch_ID` optional.
- Reorder every import menu so **Download template (CSV)** is separated at the top, followed by one grouped block for Excel, CSV, and Google Sheets.
- Add Log Waste import with preview, row-level validation, duplicate handling, skipped-row reasons, and a downloadable CSV template. Required base columns will be stage, date, time, waste type, quantity, unit, and unit cost; ingredient/menu/batch links are validated according to the selected stage.
- Replace the generic Log Waste stage hint with this exact stage-specific copy:
  - **Ingredient:** “Raw, individual ingredient. Example: spillage while preparing ingredients for a batch of pastries, burnt butter while browning it before adding to cookies, or spoilage of an ingredient before it is used.”
  - **WIP:** “Work in progress. The total ingredient cost for a product. Example: a batch of croissants accidentally burnt during prep.”
  - **Finished Product:** “Spillage or spoilage after the item was ready for sale. Example: dropped on the floor or returned by a customer for finding a hair in it.”
- Keep creator/editor/date audit captions on every waste row and verify edited waste records show the latest editor and timestamp.

## Phase 2C — Recipes and ingredient usage reference
- Add a clear Recipe section to each Individual Menu Item view, listing ingredient, quantity, unit, allocation, line cost, and recipe share.
- Link recipe ingredients to their Individual Ingredient views.
- Keep the Ingredient view’s “used in menu items” calculation tied to these same recipes so both directions remain consistent.

## Phase 3 — Sales chart revision
- Replace the eight-week bar chart with a progressive time-series line chart showing at most six weeks, oldest to newest.
- Start at the first available sales week: one week produces one point, two weeks produce two points, up to six points.
- Plot weekly revenue as the main line and a dashed rolling-average comparison line that includes the current week at every point.
- Preserve the existing no-sales state, future-sale exclusion, currency preference, tooltips, and mobile readability.

## Phase 1 — Guidance, release notes, help, and contact
- Add a subtitle under **Ongoing Insights** explaining that it surfaces time-sensitive stock and waste actions using the selected threshold.
- Add an in-app **What’s New** page with version, release date, and concise patch notes for meaningful app changes.
- Add Help/Contact access from the account menu and Business Profile area, including a mail action to `menuwise.contact@gmail.com`.
- Treat the existing Business Profile section—café name, members, and invitations—as the complete café profile editing surface. Do not add another café profile page unless the team later supplies specific requirements.

## Phase gates and verification
- **After Phase 1:** Test pending invite creation/display/cancellation/joining and delivered-email/fallback states; inactivity warning and forced login; signup password mismatch and confirmation; current-password-protected password changes; What’s New; Help/Contact; Business Profile naming; and the Ongoing Insights subtitle. Report completion and wait before Phase 2.
- **After Phase 2:** Verify all-time sales totals, medians, quadrant placement, margin percentages, square sizing, bubble-to-Analysis highlighting, Analysis-to-Individual-Menu-Item navigation, quadrant expansion, exact waste-stage copy, Production and Waste imports, waste audits, and recipe links at phone/tablet/desktop sizes. Report completion and wait before Phase 3.
- **After Phase 3:** Verify the progressive one-to-six-point Sales chart and dashed rolling average, plus the no-sales state, future-sale exclusion, currency preference, tooltips, and mobile readability. Report completion and wait before Phase 4.
- **After Phase 4:** Test owner, staff, and admin access separately; confirm ordinary users cannot list/open other cafés and that every admin café surface is read-only. Report final completion.
- At every gate, recheck Dashboard Total Sales Value, Waste as % of Sales thresholds, independent week dropdowns, offline pending-sync dots, manual sale price autofill, and edited sales captions where the phase could affect them.

## Technical details
- In Phase 4, add a dedicated role table and server-validated `has_role` helper, plus narrowly scoped read-only admin policies/functions for café monitoring and selected-café records.
- Use authenticated server functions for privileged café listing, invitation email delivery, and admin operations; load privileged clients only after owner/admin authorization.
- Add admin routes under the existing authenticated route tree and preserve current route metadata requirements.
- Reuse the existing data model for admin viewing, but do not place another café’s records into the admin device’s editable offline queue.
- Record the new admin, invitation, session-timeout, and release-note architecture in `AGENTS.md`; update the roadmap and targeted tests.

## Confirmed implementation choices
- Menu Map popularity uses **all-time total units sold**, not all-time revenue.
- Admin access is strictly **read-only**; edit mode is a future enhancement.
- Inactivity timeout is **30 minutes**.
- The app already stores display names and avatars; this revision continues using the existing account metadata and adds only a separate protected role table, not a second profile-data table.
- Invitation copy is exactly: “You have been invited to join MenuWise Analytics for {Café Name}.”
- Business Profile is the existing café name + members + invitations section; no separate café profile feature is added.
