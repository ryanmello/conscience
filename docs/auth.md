# Authentication in Conscience

This document explains how authentication works in the Conscience application, covering the complete flow from user sign-in to authenticated API requests.

## Overview

Conscience uses **Supabase Auth** for identity management with OAuth providers (Google and GitHub). The authentication flow consists of three main stages:

1. **OAuth Sign-In/Sign-Up** - User authenticates via Google or GitHub
2. **Callback & Session Creation** - Authorization code is exchanged for a session
3. **Authenticated API Requests** - JWT token is sent to the backend for verification

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Supabase   │────▶│   Callback  │────▶│   Backend   │
│  (Next.js)  │     │    OAuth     │     │   Route     │     │  (FastAPI)  │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │                    │
      │  1. Click Login    │                    │                    │
      │───────────────────▶│                    │                    │
      │                    │                    │                    │
      │  2. Redirect to    │                    │                    │
      │     Provider       │                    │                    │
      │◀───────────────────│                    │                    │
      │                    │                    │                    │
      │  3. User authorizes│                    │                    │
      │───────────────────▶│                    │                    │
      │                    │                    │                    │
      │  4. Redirect with  │                    │                    │
      │     auth code      │───────────────────▶│                    │
      │                    │                    │                    │
      │                    │  5. Exchange code  │                    │
      │                    │◀───────────────────│                    │
      │                    │                    │                    │
      │                    │  6. Return session │                    │
      │                    │───────────────────▶│                    │
      │                    │                    │                    │
      │  7. Set cookies &  │                    │                    │
      │     redirect to app│◀───────────────────│                    │
      │                    │                    │                    │
      │  8. API request with Bearer token       │                    │
      │─────────────────────────────────────────────────────────────▶│
      │                    │                    │                    │
      │  9. Validate JWT   │                    │                    │
      │◀─────────────────────────────────────────────────────────────│
```

---

## Stage 1: OAuth Sign-In / Sign-Up

### Frontend Implementation

The sign-in and sign-up pages (`/sign-in` and `/sign-up`) use Supabase's client-side OAuth integration. Both pages follow the same pattern:

**Location:** `ui/app/(auth)/sign-in/page.tsx` and `ui/app/(auth)/sign-up/page.tsx`

```typescript
const handleOAuthSignIn = async (provider: "google" | "github") => {
    setIsLoading(provider);

    // Build callback URL with optional redirect parameter
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (redirectUrl) {
        callbackUrl.searchParams.set("next", redirectUrl);
    }

    const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: callbackUrl.toString(),
        },
    });

    if (error) {
        console.error("OAuth error:", error.message);
        setIsLoading(null);
    }
};
```

### Key Points

- **Supabase Client**: Created using `createBrowserClient` from `@supabase/ssr`
- **OAuth Providers**: Google and GitHub are supported
- **Redirect URL**: The `redirectTo` option tells Supabase where to send the user after OAuth authorization
- **Optional Next Parameter**: A `redirect` query parameter can be passed to the sign-in page, which gets forwarded as `next` to the callback route for post-authentication navigation

### Supabase Browser Client

**Location:** `ui/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

---

## Stage 2: OAuth Callback & Session Creation

After the user authorizes with Google or GitHub, they are redirected back to our application with an authorization code.

### Callback Route

**Location:** `ui/app/(auth)/auth/callback/route.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  if (code) {
    const response = NextResponse.redirect(`${siteUrl}/build`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      return response;
    }
  }

  return NextResponse.redirect(`${siteUrl}/auth/auth-code-error`);
}
```

### What Happens Here

1. **Extract Authorization Code**: The `code` query parameter contains the OAuth authorization code
2. **Create Server Client**: A Supabase server client is created with cookie handling capabilities
3. **Exchange Code for Session**: `exchangeCodeForSession(code)` calls Supabase to exchange the authorization code for:
   - `access_token` - A JWT used to authenticate API requests
   - `refresh_token` - Used to obtain new access tokens when they expire
4. **Set Session**: The session tokens are stored in HTTP-only cookies via the cookie handler
5. **Redirect**: User is redirected to `/build` on success, or `/auth/auth-code-error` on failure

### Session Storage

The Supabase session is stored in HTTP-only cookies, which:
- Persist across browser sessions
- Are automatically sent with requests
- Are secure from JavaScript access (XSS protection)

---

## Stage 3: Authenticated API Requests

Once authenticated, the frontend needs to send the access token to the backend for protected API calls.

### Server Action (Frontend)

**Location:** `ui/actions/process-input.ts`

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";

export async function processInput(input: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (!apiUrl) {
    return { success: false, error: "NEXT_PUBLIC_API_URL is not configured" };
  }

  // Get the current session from Supabase
  const supabase = await createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Send the access token as a Bearer token
    const response = await fetch(`${apiUrl}/api/process_input`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ input }),
    });

    if (response.status === 401) {
      return { success: false, error: "Session expired. Please sign in again." };
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error calling API:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
```

### Key Points

- **Server Actions**: This runs on the Next.js server, not in the browser
- **Session Retrieval**: `getSession()` reads the session from cookies
- **Authorization Header**: The access token is sent as `Authorization: Bearer <token>`
- **Error Handling**: 401 responses indicate the session has expired

---

## Stage 4: Backend JWT Verification

The Python/FastAPI backend validates the JWT token from Supabase.

### Authentication Module

**Location:** `api/auth.py`

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

security = HTTPBearer()
_jwks_client: Optional[PyJWKClient] = None

def get_jwks_client() -> PyJWKClient:
    """Get or create cached JWKS client for Supabase token verification."""
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """Validate Supabase JWT and return authenticated user."""
    token = credentials.credentials

    try:
        # Get the signing key from Supabase's JWKS endpoint
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and validate the JWT
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "HS256"],
            audience="authenticated"
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )

        return User(
            id=user_id,
            email=payload.get("email"),
            role=payload.get("role")
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### How JWT Verification Works

1. **Extract Token**: The `HTTPBearer` security scheme extracts the token from the `Authorization: Bearer <token>` header
2. **Fetch Public Keys**: The JWKS (JSON Web Key Set) client fetches Supabase's public keys from `/.well-known/jwks.json`
3. **Verify Signature**: The JWT signature is verified using the public key
4. **Validate Claims**: The token is checked for:
   - Valid signature
   - Not expired (`exp` claim)
   - Correct audience (`"authenticated"`)
5. **Extract User Info**: User ID, email, and role are extracted from the JWT payload

### Using Authentication in Routes

**Location:** `api/conscience.py`

```python
from fastapi import APIRouter, Depends
from api.auth import get_current_user, User

router = APIRouter()

@router.post("/process_input", response_model=AIResponse)
async def process_input(request: AIRequest, user: User = Depends(get_current_user)):
    """Process user input - requires authentication."""
    logger.info(f"Processing request from user {user.id}: {request.input}")
    return AIResponse(output=request.input)
```

Protected endpoints use `Depends(get_current_user)` to require authentication. If the token is invalid or missing, a 401 Unauthorized response is returned automatically.

---

## Token Lifecycle

### Access Token

- **Lifetime**: Typically 1 hour (configured in Supabase)
- **Contents**: User ID (`sub`), email, role, expiration time, and other claims
- **Usage**: Sent with every authenticated API request

### Refresh Token

- **Lifetime**: Much longer (typically 7 days or more)
- **Usage**: Used to obtain new access tokens when they expire
- **Handling**: Supabase client libraries handle token refresh automatically

### Token Refresh Flow

The Supabase client automatically refreshes tokens before they expire:

1. Client detects access token is about to expire
2. Refresh token is sent to Supabase
3. New access token (and possibly new refresh token) is returned
4. New tokens are stored in cookies

---

## Environment Variables

### Frontend (Next.js)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_SITE_URL` | Your application's URL (for redirects) |
| `NEXT_PUBLIC_API_URL` | URL of the Python backend |

### Backend (FastAPI)

| Variable | Description |
|----------|-------------|
| `SUPABASE_PROJECT_URL` | Your Supabase project URL |
| `SUPABASE_SECRET_API_KEY` | Supabase service role key (server-side only) |

---

## Security Considerations

### What's Protected

- **Access tokens** are stored in HTTP-only cookies (not accessible via JavaScript)
- **JWT verification** happens on every protected request
- **JWKS caching** prevents repeated network calls but keys are refreshed periodically

### Best Practices

1. Never expose the `SUPABASE_SECRET_API_KEY` to the client
2. Always use HTTPS in production
3. Keep access token lifetimes short
4. Handle 401 errors by redirecting to sign-in
5. Use server actions or API routes for authenticated requests (not client-side fetch with tokens)

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Token expired or invalid | Redirect to sign-in |
| Token has expired | Access token lifetime exceeded | Token refresh should happen automatically; if not, re-authenticate |
| Invalid token | Malformed or tampered token | Clear session and re-authenticate |
| Not authenticated | No session found | User needs to sign in |

### Error Pages

- `/auth/auth-code-error` - Displayed when OAuth callback fails (invalid code, etc.)

---

## Summary

1. **User clicks "Sign in with Google/GitHub"** → Supabase redirects to OAuth provider
2. **User authorizes** → Redirected back to `/auth/callback` with authorization code
3. **Callback exchanges code for session** → Tokens stored in cookies
4. **Frontend makes API request** → Access token sent as `Bearer` token
5. **Backend verifies JWT** → Uses Supabase's public keys (JWKS) to validate
6. **Request processed** → User info extracted from token, request handled
