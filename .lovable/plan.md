# Disallow spaces in passwords

Currently the password checks only require 6–72 characters, so "a b c" or a password with a trailing space is accepted on both the create-account form and the reset-password form. We will reject any password that contains a space or tab at either place.

## Changes

1. `src/routes/login.tsx`
   - Extend the password schema with a no-whitespace check: a password containing any space/tab fails with "Password can't contain spaces".
   - Applies to both log in and create account (same schema).

2. `src/routes/reset-password.tsx`
   - Add the same check to the "Set a new password" form so a reset can't set a password with spaces either.

## Notes

- Existing accounts are untouched — this only affects new sign-ups and password resets. Anyone who already has a space in their password can still log in.
- Supabase itself accepts spaces, so this is enforced in the app's validation only.
- After the edit, verify with the typecheck and a quick browser check that "pass word" is rejected with the new message while a normal password still works.
