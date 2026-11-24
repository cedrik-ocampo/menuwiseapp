# Setup popup shows only once per new owner

## Goal
After a new owner finishes (or closes) the "Welcome to MenuWise" setup popup, it never opens again on later logins, including on another device or browser.

## Current behavior
- The popup opens when an owner's café has no ingredients, menu items or sales.
- Closing it saves a "seen" flag only in that browser. If you log in on another device or clear the browser, the popup can come back. Naming the café or inviting staff does not count as progress.

## Changes
1. Save "setup done" to the owner's account, not just the browser. Closing the popup, or finishing any setup step (naming the café, inviting a team member, or importing data), marks the account as set up.
2. The popup opens only when all of these are true:
   - the user is an owner,
   - their account is not marked as set up,
   - the café is still empty and still has the default name.
3. Existing accounts with data are never interrupted.
4. The setup guide on Profile stays available any time.
5. If the user is offline, the browser flag still applies, and the account flag saves once they are back online.

## Technical details
- Store `setup_completed_at` in the user's auth metadata via `supabase.auth.updateUser({ data })`. Read it from the session user in `SetupModal`. No database change needed.
- `SetupWizard` calls an `onProgress` callback after saving the café name or an invite. `SetupModal` uses it to set the flag.
- Keep the per-user and per-café localStorage key as a fallback for offline use.
