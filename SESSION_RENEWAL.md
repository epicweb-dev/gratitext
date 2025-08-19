# Session Renewal Implementation

This document explains how to use the new session renewal functionality that automatically extends user sessions when they make authenticated requests.

## Overview

The session renewal system provides:
- **Idle timeout**: 14 days - resets on user activity
- **Absolute max lifetime**: 90 days since login - cannot be extended beyond this
- **Session ID rotation**: New session IDs are generated when renewing for security
- **Secure cookies**: HttpOnly, Secure, SameSite=Lax flags maintained

## How It Works

1. **Automatic Renewal**: When a user makes an authenticated request, the system checks if their session is within 7 days of expiration
2. **Session Rotation**: If renewal is needed, a new session is created with a new ID and extended expiration
3. **Cookie Update**: The new session cookie is automatically included in the response

## Usage in Routes

### Loader Functions

```typescript
import { requireUserId, handleSessionRenewal } from '#app/utils/auth.server.ts'

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request)
  
  // Your loader logic here...
  const data = await getSomeData(userId)
  
  // Handle session renewal if needed
  const responseInit = handleSessionRenewal(request)
  return json(data, responseInit)
}
```

### Action Functions

```typescript
import { requireUserId, handleSessionRenewal } from '#app/utils/auth.server.ts'

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request)
  
  // Your action logic here...
  await updateSomething(userId)
  
  // Handle session renewal if needed
  const responseInit = handleSessionRenewal(request)
  return redirect('/success', responseInit)
}
```

### Redirects with Toast

```typescript
import { requireUserId, handleSessionRenewal } from '#app/utils/auth.server.ts'

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request)
  
  // Your action logic here...
  await deleteSomething(userId)
  
  // Handle session renewal if needed
  const responseInit = handleSessionRenewal(request)
  return redirectWithToast('/success', {
    type: 'success',
    title: 'Success',
    description: 'Operation completed successfully.',
  }, responseInit)
}
```

## Key Functions

- `requireUserId(request)`: Authenticates user and triggers session renewal if needed
- `getUserId(request)`: Same as above but doesn't redirect on failure
- `handleSessionRenewal(request)`: Returns response init with session renewal cookies
- `combineSessionHeaders(request, existingHeaders)`: Combines session headers with existing headers

## Security Features

- **Session ID Rotation**: New session IDs are generated on each renewal
- **Absolute Lifetime Limit**: Sessions cannot exceed 90 days regardless of activity
- **Automatic Cleanup**: Old sessions are automatically deleted from the database
- **Secure Cookies**: All security flags are maintained during renewal

## Database Impact

- Old sessions are automatically deleted when renewed
- New sessions are created with extended expiration dates
- The `createdAt` timestamp is preserved to track absolute lifetime

## Migration Notes

Existing routes will continue to work without changes. To enable session renewal:

1. Import `handleSessionRenewal` from `#app/utils/auth.server.ts`
2. Call it after `requireUserId` or `getUserId`
3. Pass the result to your response functions

## Example Migration

**Before:**
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request)
  const data = await getData(userId)
  return json(data)
}
```

**After:**
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request)
  const data = await getData(userId)
  
  const responseInit = handleSessionRenewal(request)
  return json(data, responseInit)
}
```