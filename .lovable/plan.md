# Profile menu + Sales weekly revenue

## Part A — User menu and Profile page

1. **Header user menu** replaces the Sign out button: round avatar (initials fallback) + name on the right of the navy header. Dropdown: bold name, muted email, divider, Profile, Sign out. Closes on outside click, Escape, or selection. On mobile it opens full-width below the header.
2. **`/profile`** protected page, not in the tab bar or sidebar. Sections:
   - **Account** — avatar upload, editable display name, read-only email with "Change email" modal, "Change password" modal.
   - **Workspace** — café name, members list (name, email, role), Invite member (reuses Team invite), Leave workspace (hidden when sole member). The existing Team button in the header is removed since this replaces it; `/team` redirects to `/profile`.
   - **Preferences** (saved on the device, work offline) — Appearance Light/Dark/System, default landing page Dashboard/Sales/Menu Map, default Ongoing Insights window 7/14/30, currency P / ₱ (default stays ₱).
   - **Data** — Export my data (CSV of the whole workspace), Clear local cache (confirm, wipe device copy, re-sync).
   - **Danger zone** (red) — Delete account.
3. **Delete account** modal with the two exact warnings (sole member vs. shared), "Type DELETE to confirm". Sole member: café and all its data deleted. Shared: user removed, their name on logs replaced with "Former member". Then device data cleared, signed out, sent to Login with a toast.
4. **Demo mode**: Delete account is disabled with tooltip "Disabled in demo mode." on the published site (detected by the published web address, plus an on/off setting), active in preview.
5. **Offline**: name, café name, email, password, avatar and delete show "You're offline. Reconnect to save this change."

Note: the "Default Sales chart period" preference is dropped, because Part B removes that chart.

## Part B — Sales page weekly revenue

- Remove the range toggle, the 30-day line chart and its empty state; nothing else changes.
- Add an 8-bar chart in the same spot: This Week, Last Week, 2w … 7w (newest left). Weeks run Monday–Sunday in local time; This Week counts Monday→today, has a lighter shade with dashed outline, and the tooltip says "Week of {start}–{end}: ₱X".
- ₱ value above each bar; zero weeks show a flat grey bar labeled ₱0.00. Sales dated in the future are ignored.
- No sales at all: "No sales yet. Log or import sales to see weekly revenue." with no bars.
- Line under the chart: "Average weekly revenue (last 4 weeks): ₱X" (the 4 full weeks, not counting This Week).
- No data changes; uses the existing sales records.

## Technical details

- New `src/components/mw/UserMenu.tsx` (shadcn DropdownMenu), `src/routes/_authenticated/profile.tsx`, `src/lib/prefs.ts` (localStorage + hook; theme toggles `.dark` on `<html>`; landing page applied after login redirect; insights window feeds the existing threshold; `formatPeso` reads the currency pref).
- Email/password via `supabase.auth.updateUser`; avatar stored as a resized data URL in user metadata.
- `deleteAccount` server function with `requireSupabaseAuth`; checks membership with the user's client, then loads the admin client to delete workspace records/members (sole) or anonymize created/updated-by fields and remove membership (shared), then deletes the auth user.
- Clear cache: delete IndexedDB, reset sync cursor, reload.
- Demo flag: `VITE_DEMO_MODE` or hostname matching the published URL.
- `weeklyRevenue(sales, today)` in `src/lib/calc.ts` with a unit test for week boundaries, partial week and future dates; SalesTab drops `RANGE_OPTIONS`.
- Update routing test for `/profile`; `AGENTS.md` note on profile/preferences.
