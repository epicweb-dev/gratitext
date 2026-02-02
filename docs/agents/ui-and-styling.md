# UI and styling

- Use `cn()` from `app/utils/misc.tsx` to merge class names; it includes a
  Tailwind-aware merge configured with the app's extended theme.
- Use `useDelayedIsPending()` to show loading UI without flicker.
- Use `useDoubleCheck()` for destructive actions that need a confirm-style
  second click.
