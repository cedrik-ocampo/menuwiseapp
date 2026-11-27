# Reorder Home dashboard modules

## Layout

```text
Top row (3 columns on wide screens):
[ Total Waste Value ] [ Total Sales Value ] [ Menu Distribution Overview ]

Bottom row (2 columns on wide screens):
[ Ongoing Insights ▾ ]  [ Suggested orders and batches ▾ ]
```

On phones and narrow screens the modules stack in the same order.

## Show / hide arrows
- Ongoing Insights and Suggested orders and batches each get a down/up arrow in their title bar.
- Collapsed: only the title, controls (expiry threshold, waste cap) and a short count, e.g. "3 insights" or "22 suggestions".
- Expanded: the full list, as it is today.
- Start collapsed; the choice is remembered on this device.
- The "Actioned insights" history stays its own extra drop-down inside Ongoing Insights.

## Unchanged
- All numbers, actions (Accept / Maybe / Reject, Mark as ordered, Edit, Ignore) and the waste stage breakdown behave as now.
- The Ingredients and Menu Item pages that also show suggestions are not changed.

## Technical details
- `src/routes/_authenticated/index.tsx`: top grid becomes `lg:grid-cols-3` holding the waste panel, sales panel and Menu Distribution panel (moved up); bottom grid `lg:grid-cols-2` holding Ongoing Insights and `<SuggestedOrders />`.
- Add an optional `collapsible` prop to `SuggestedOrders` so only the Home usage gets the arrow.
- Collapse state stored via the existing localStorage prefs pattern (`src/lib/prefs.ts`), read after mount to avoid hydration mismatch.

## Use the full width, no awkward gaps
- Both rows stretch across the whole content area with the same gap between every module.
- Modules in the same row line up to the same height, so no empty patches under shorter cards; content sits at the top and the card background fills the rest.
- Collapsed lists keep both bottom modules the same compact height; expanded lists scroll inside the card (max height) instead of pushing the page down unevenly.
- Menu Distribution Overview uses a tighter layout to fit its column without leaving blank space.
- Check at wide desktop, laptop and phone widths.
