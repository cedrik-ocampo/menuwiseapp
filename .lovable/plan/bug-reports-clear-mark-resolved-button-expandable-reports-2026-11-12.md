# Bug Reports: clear "Mark resolved" button + expandable reports

## What changes (admin Bug Reports page only)
1. **Mark resolved button** — each open report gets a clear button labelled "Mark resolved" (with a check icon). Resolved reports show a green "Resolved" badge plus a small "Reopen" link. A toast confirms the change; the button shows "Saving…" while it works.
2. **Expand a report** — each report starts collapsed: title, status, café, reporter, date, and the first two lines of the description. Clicking the row (or a "View details" chevron) expands it to show:
   - the full description
   - café, reporter name and email, date and time, and the page it was sent from
   - the Mark resolved / Reopen action
   Click again to collapse.
3. **Filter tabs** at the top: Open / Resolved / All (default Open), with counts, so resolved reports get out of the way.

## Technical details
- Edit only `src/routes/_authenticated/admin.bugs.tsx`; reuse the existing `setBugStatus` and `listBugReports` server functions (no backend changes).
- Local state for expanded ids and the filter; `line-clamp-2` for the collapsed description; chevron icon from lucide-react.
