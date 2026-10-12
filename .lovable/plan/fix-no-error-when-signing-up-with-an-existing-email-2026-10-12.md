# Fix: no error when signing up with an existing email

## Problem
On the login page's "Create account" mode, entering an email that already has an account shows the success message "Check your email to confirm your account" instead of telling the user the email is already registered. No account is created, so the user waits for a confirmation email that never arrives.

## Root cause (confirmed in `src/routes/login.tsx`, lines 59–64)
The auth backend intentionally returns a fake success for duplicate sign-ups (a security measure so attackers can't probe which emails are registered). The duplicate case is detectable in the response: `data.user.identities` is an **empty array** when the email already exists, versus a populated array for a genuinely new account. The current code never checks this, so it falls through to the "check your email" success message.

## Change
In `src/routes/login.tsx`, in the signup branch of `submit()`:

- After a successful `signUp()` with no session, check `data.user?.identities`:
  - **Empty array (email already registered):** show an error message: "An account with this email already exists. Try logging in instead, or use 'Forgot password' if you can't sign in."
  - **Populated (genuinely new account):** keep the existing "Check your email to confirm your account, then log in." message.
- Keep the existing `error` and `data.session` handling unchanged.

## Verification
- Sign up with a brand-new email → "check your email" message still appears.
- Sign up again with an email that already has a confirmed account → the "already exists" error appears instead.
- Normal login and forgot-password flows unchanged.
- Run `bunx tsgo --noEmit` and the existing vitest suite.
