<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Data is scoped per café workspace: `records` is keyed by (workspace_id, collection, id) and RLS checks `is_workspace_member`; the client resolves its workspace via the `ensure_workspace` RPC (joins pending invites by email). Why: staff at one café share the same data.
- Every write through `put`/`remove` stamps created/updated-by fields and appends a `changeLogs` record (synced like other collections). Why: edits must show who changed what and when, even offline.
- Sales is a protected top-level `/sales` route while menu-item sales history remains reusable on detail pages. Why: Sales has its own primary workflow without duplicating its data model.
- Account settings live on the protected `/profile` route reached only from the header user menu; device preferences (theme, landing page, currency) live in `src/lib/prefs.ts` localStorage. Why: per-device settings must work offline and stay out of main navigation.
- Account deletion and leaving a workspace run in authenticated server functions that verify membership before using the admin client. Why: removing users and anonymizing shared records needs privileged access.
- Owner-managed café invitations use authenticated server functions, while invitation email delivery depends on a configured app-email domain. Why: invitation access must be authorized server-side and email availability must not block the pending invite.
- Signed-in sessions end after 30 minutes of inactivity without clearing IndexedDB. Why: shared café devices need re-authentication without discarding offline work.
- Release notes and support live on protected `/whats-new` and `/help` routes linked from the account menu. Why: operational guidance stays accessible without crowding primary navigation.
- MenuWise admin access is a `user_roles` role checked by `has_role`; admins get an admin-only layout (Café Monitoring, no café store/tabs), reads use SELECT-only RLS, and edits go through an authenticated server function that verifies the role, writes via the admin client, and appends an `adminEdit` changeLogs record in the café. Why: admin edits must be authorized server-side and visible to both the café and the admin's own log.
- Bug reports are stored in `bug_reports` (members insert/read own; admin reads and updates status via authenticated server functions). Why: reports must reach the admin inbox without exposing other users' reports.
- Menu Map popularity is all-time total units sold (future sales excluded). Why: team decision for a stable popularity axis.
- Menu-item recipes store ingredient IDs internally but owner-facing setup and imports select ingredients by name; all recipe costing uses compatible-unit conversion from the ingredient's saved unit. Why: café owners need readable setup without losing reliable inventory links or cost accuracy.
- Menu Items and Menu Map are separate top-level workflows, while menu item details remain under `/menu/$id`. Why: catalog setup and menu-engineering analysis are distinct owner tasks without duplicating records.
