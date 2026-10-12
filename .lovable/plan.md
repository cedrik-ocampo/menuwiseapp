# Checklist 4 revisions

## 1. Menu Map Analysis (priority)
- Clicking an item name in Analysis switches to the **Menu Catalog** tab, scrolls to that item's card and highlights it. This replaces the earlier "open item page" behavior.
- Quadrant summary formatting, one value per line with clear labels:
  ```text
  Stars (4)
  Highest Waste: Sourdough Loaf (₱65.00)
  Lowest Waste: Almond Croissant (₱0.00)
  ```
- A small "View all {n} items" button at the bottom of each quadrant box expands to show every item in it, with a "Show less" option.

## 2. Admin Café Monitoring: all accounts
- The café list shows every account in each café (owner and staff, with name and email), not only the owner.

## 3. Invitations
- If a sending domain for invitation emails is set up, the email is sent with the invite message and a sign-up link.
- Until then, each pending invite shows a clear note: "Email not sent — ask this person to sign up at MenuWise with this email address to join your café." It also includes a copyable sign-up link.

## 4. Footer contact text
- A small line at the bottom of every signed-in page: "Need help or have concerns? Contact menuwise.contact@gmail.com" (the address opens an email).

## 5. Production History on Log Production
- Add the Production History list below the Log Production form, using the same component as the Menu Map.

## 6. Bug reporting (in-app admin inbox)
- A "Report a bug" option in the account menu and on Help: a short form with a title, a description, and an automatically attached page/device info.
- Reports are saved with the reporter and café. The reporter sees a confirmation.
- The admin gets a new **Bug Reports** tab showing every report, its café, reporter, date and status. The admin can mark each one Open or Resolved.

## 7. Sales chart comparison line
- Replace the rolling-average dashed line with a **straight horizontal dashed line** at the average weekly revenue up to and including last week. The current week is excluded. When no completed past week exists, the line is hidden.

## Technical details
- New `bug_reports` table (id, workspace_id, user_id, reporter name/email, title, description, page, user_agent, status, created_at). RLS: members insert/select their own; admin select/update via `has_role`. Admin list/update use authenticated server functions.
- `listCafes` returns a `members[]` array (name, email, role) from workspace_members + auth users via the admin client.
- Invitation server function returns `emailSent`. The UI shows the fallback note when it is false.
- Menu Map view state gains `focusId` for the catalog; MenuInventory highlights and scrolls to it.
- Add AGENTS.md rule for bug reports; update tests for the weekly-average line.
