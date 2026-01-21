import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/";

  if (!next.startsWith("/")) {
    next = "/";
  }

  if (code) {
    // Determine redirect URL
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    let redirectUrl: string;
    if (isLocalEnv) {
      redirectUrl = `${origin}${next}`;
    } else if (forwardedHost) {
      redirectUrl = `https://${forwardedHost}${next}`;
    } else {
      redirectUrl = `${origin}${next}`;
    }

    // Create the redirect response FIRST so we can set cookies on it
    const response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // exchangeCodeForSession doesn't trigger setAll, so we must call setSession
      // to force the cookies to be written to the response
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
