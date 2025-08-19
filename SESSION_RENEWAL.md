# Session Renewal Implementation

This document explains how the session renewal functionality works in your Epic
Stack application.

## Overview

The session renewal system provides:

- **Idle timeout**: 14 days - resets on user activity
- **Absolute max lifetime**: 90 days since login - cannot be extended beyond
  this
- **Session ID rotation**: New session IDs are generated when renewing for
  security
- **Secure cookie flags**: HttpOnly, Secure, SameSite=Lax maintained
- **Automatic handling**: No manual intervention required in routes

## How It Works

1. **Automatic Renewal**: When a user makes an authenticated request, the system
   checks if their session is within 7 days of expiration
2. **Session Rotation**: If renewal is needed, a new session is created with a
   new ID and extended expiration
3. **Automatic Cookie Update**: The new session cookie is automatically included
   in the response via `entry.server.tsx`

## Implementation Details

### Core Logic (`app/utils/auth.server.ts`)

The session renewal logic is built into the `getUserId()` function:

- **Session Validation**: Checks if session exists and is not expired
- **Renewal Detection**: Identifies sessions within 7 days of expiration
- **Lifetime Check**: Enforces absolute 90-day maximum lifetime
- **Session Rotation**: Creates new sessions with new IDs for security
- **Request Annotation**: Stores renewal info in the request object for
  `entry.server.tsx`

### Automatic Handling (`app/entry.server.tsx`)

The `handleDataRequest` function automatically handles session renewal:

- **Cookie Generation**: Creates new session cookies when renewal is detected
- **Header Injection**: Automatically adds `set-cookie` headers to responses
- **Transparent Operation**: No changes required in individual routes

## Usage

**No changes required in your routes!** The session renewal happens
automatically.

### Example Route (Before and After)

**Before (and still works the same):**

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const data = await getData(userId)
	return json(data)
}
```

**After (exactly the same):**

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const data = await getData(userId)
	return json(data)
}
```

The session renewal happens automatically in the background without any code
changes.

## Security Features

- **Session ID Rotation**: New session IDs are generated on each renewal
- **Absolute Lifetime Limit**: Sessions cannot exceed 90 days regardless of
  activity
- **Automatic Cleanup**: Old sessions are automatically deleted from the
  database
- **Secure Cookies**: All security flags are maintained during renewal
- **Transparent Operation**: No security risks from manual implementation

## Database Impact

- Old sessions are automatically deleted when renewed
- New sessions are created with extended expiration dates
- The `createdAt` timestamp is preserved to track absolute lifetime

## Benefits of This Approach

1. **Non-Intrusive**: No changes required to existing routes
2. **Automatic**: Session renewal happens transparently
3. **Centralized**: All session logic is in one place
4. **Future-Proof**: Ready for React Router middleware when available
5. **Maintainable**: Single point of control for session behavior

## How to Test

1. **Login with "Remember Me"**: Check that the initial session has a 90-day
   expiration
2. **Make Authenticated Requests**: Verify that sessions are renewed when within
   7 days of expiration
3. **Check Cookie Expiration**: Verify that cookies are extended on renewal
4. **Monitor Database**: Check that old sessions are cleaned up and new ones
   created

## Configuration

The session timing can be adjusted in `app/utils/auth.server.ts`:

```typescript
export const SESSION_IDLE_TIMEOUT = 1000 * 60 * 60 * 24 * 14 // 14 days
export const SESSION_ABSOLUTE_MAX_LIFETIME = 1000 * 60 * 60 * 24 * 90 // 90 days
```

The renewal threshold (7 days) is hardcoded in the `getUserId` function and can
be adjusted if needed.
