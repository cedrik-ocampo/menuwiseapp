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
