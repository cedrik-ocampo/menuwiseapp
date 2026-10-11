# MenuWise Checklist 3 revision plan

## Goal
Implement the new capstone checklist as one coordinated revision while preserving the empty-café experience, offline-first records, workspace sharing, audit history, and existing Dashboard week selectors.

## 1. Secure MenuWise admin monitoring
- Add a protected backend `admin` role, assigned to `menuwise.contact@gmail.com`; never infer admin access from browser storage or editable account details.
- Add an admin-only **Café Monitoring** page listing every café, its owner, member count, record activity, sync recency, and progress/usage counts.
- Let an admin open any café in the familiar MenuWise layout. The café opens read-only with a persistent “Viewing as MenuWise admin” banner.
- Add an explicit **Edit mode** switch before any operational data can be changed. Edit mode permits the normal add/edit/delete flows and keeps full “changed by / changed on” auditing.
- Add an admin café-member view showing owners, staff, and pending invitations.
- Keep all cross-café reads and writes protected by backend role checks and database policies; ordinary owners and staff remain restricted to their own café.

## 2. Business Profile, invitations, and account safety
- Rename the Profile page’s **Workspace** section to **Business Profile**.
- Show pending invitations, including email, sender/date, and a cancel action for the café owner.
- Replace the current browser-only invite insert with a protected owner action that stores the pending invite and sends a sign-up invitation when email delivery succeeds. The pending invite remains visible if delivery fails, with a clear retry state.
- Use the invitation message: “You have been invited to join MenuWise Analytics for {Café Name}.” Existing users continue to join their invited café at sign-in.
- Add inactivity protection: after **30 minutes** without keyboard, pointer, touch, or navigation activity, sign out and require login again. Show a short warning before timeout and preserve unsynced offline records locally.
- Add **Confirm password** to account creation, validate that both entries match before signup, and keep the existing email-confirmation step.
- Update signed-in password changes to require the current password as well as matching new-password fields.

## 3. Menu engineering correction and interaction
- Change popularity from 30-day average weekly sales to **all-time total units sold per menu item**. Rename the X-axis, tooltips, captions, table values, and menu-item KPI so the metric is unambiguous.
- Keep profitability based on unit margin, but add **Margin %** beside **Sales Volume** in the Analysis view.
- Make the bubble plot a stable 1:1 square on every screen, with responsive scrolling/containment where needed.
- Rename Menu Map views to **Bubble Chart**, **Analysis**, and **Menu Catalog**.
- Clicking a bubble switches to Analysis, expands its quadrant if needed, scrolls to the row, and visibly highlights that item.
- Clicking an item name in Analysis opens that item’s Menu Catalog card rather than immediately leaving the page; the card retains Modify, full view, and Delete actions.
- Format each quadrant summary with item count, highest-waste item/value, and lowest-waste item/value. Initially show a concise subset and add **View all {n} items** / collapse controls.
- Preserve zero-sales items in Menu Catalog and the existing “not yet classified” treatment, but do not plot them or include them in quadrant medians.

## 4. Production and waste imports/forms
- Production form starts with **Select a menu item** instead of preselecting the first item.
- Move **+ Create new menu item** below the Production Log Form so it does not flatten the heading/action row.
- Keep production import columns exactly: `Menu_Item_ID`, `quantity`, `producedAt`, `expiryDate`, with `Batch_ID` optional.
- Reorder every import menu so **Download template (CSV)** is separated at the top, followed by one grouped block for Excel, CSV, and Google Sheets.
- Add Log Waste import with preview, row-level validation, duplicate handling, skipped-row reasons, and a downloadable CSV template. Required base columns will be stage, date, time, waste type, quantity, unit, and unit cost; ingredient/menu/batch links are validated according to the selected stage.
- Replace the generic Log Waste stage hint with stage-specific explanatory copy that updates when Ingredient, WIP, or Finished Product is selected, using the checklist’s examples.
- Keep creator/editor/date audit captions on every waste row and verify edited waste records show the latest editor and timestamp.

## 5. Recipes and ingredient usage reference
- Add a clear Recipe section to each Individual Menu Item view, listing ingredient, quantity, unit, allocation, line cost, and recipe share.
- Link recipe ingredients to their Individual Ingredient views.
- Keep the Ingredient view’s “used in menu items” calculation tied to these same recipes so both directions remain consistent.

## 6. Sales chart revision
- Replace the eight-week bar chart with a progressive time-series line chart showing at most six weeks, oldest to newest.
- Start at the first available sales week: one week produces one point, two weeks produce two points, up to six points.
- Plot weekly revenue as the main line and a dashed rolling-average comparison line that includes the current week at every point.
- Preserve the existing no-sales state, future-sale exclusion, currency preference, tooltips, and mobile readability.

## 7. Guidance, release notes, help, and contact
- Add a subtitle under **Ongoing Insights** explaining that it surfaces time-sensitive stock and waste actions using the selected threshold.
- Add an in-app **What’s New** page with version, release date, and concise patch notes for meaningful app changes.
- Add Help/Contact access from the account menu and Business Profile area, including a mail action to `menuwise.contact@gmail.com`.
- Expand Business Profile into the café profile editing surface while keeping account settings and device preferences separate.

## Verification
- Test owner, staff, and admin access separately; confirm ordinary users cannot list or open other cafés and read-only admin mode blocks writes.
- Test pending invite creation, display, cancellation, joining, and the delivered-email/fallback states.
- Test inactivity warning and forced login, signup password mismatch, account confirmation, and current-password-protected password changes.
- Verify all-time sales totals, medians, quadrant placement, margin percentages, square chart sizing, bubble-to-Analysis highlighting, Analysis-to-Menu-Catalog opening, and quadrant expansion at phone/tablet/desktop sizes.
- Import valid and invalid Production and Waste files in Excel/CSV flows and verify template placement, previews, duplicate handling, skipped rows, and audit captions.
- Verify recipe links in both directions and the progressive one-to-six-point Sales chart with its dashed rolling average.
- Recheck Dashboard Total Sales Value, Waste as % of Sales thresholds, independent week dropdowns, offline pending-sync dots, manual sale price autofill, and edited sales captions.

## Technical details
- Add a dedicated role table and server-validated `has_role` helper, plus narrowly scoped admin policies/functions for café monitoring and selected-café records.
- Use authenticated server functions for privileged café listing, invitation email delivery, and admin operations; load privileged clients only after owner/admin authorization.
- Add admin routes under the existing authenticated route tree and preserve current route metadata requirements.
- Reuse the existing offline record store by adding an explicit admin-selected workspace/read-only mode rather than creating a second data model.
- Record the new admin, invitation, session-timeout, and release-note architecture in `AGENTS.md`; update the roadmap and targeted tests.

## Assumptions requiring confirmation before implementation
- Menu Map popularity uses **all-time total units sold**, not all-time revenue.
- Admin Edit mode may edit all café operational records after being explicitly enabled.
- Inactivity timeout is **30 minutes**.
- The app already stores display names and avatars; this revision continues using the existing account metadata and adds only a separate protected role table, not a second profile-data table.
