"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { SocialAuthButton } from "@/components/social-auth-button";
import { createClient } from "@/lib/supabase/client";
import { Workflow } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function SignUpContent() {
    const [isLoading, setIsLoading] = useState<"google" | "github" | null>(null);
    const searchParams = useSearchParams();
    const supabase = createClient();

    // Get redirect URL from query params (used for OAuth consent flow)
    const redirectUrl = searchParams.get("redirect");

    const handleOAuthSignUp = async (provider: "google" | "github") => {
        try {
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
        } catch (error) {
            console.error("Unexpected error:", error);
            setIsLoading(null);
        }
    };

    return (
        <div className="flex flex-col gap-8 min-h-screen items-center justify-center p-4">
            <div className="flex items-center justify-center gap-2">
                <Workflow size={36} />
                <h1 className="text-4xl font-semibold tracking-tight">Conscience</h1>
            </div>
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-semibold">Create an account</CardTitle>
                    <CardDescription>
                        Get started with Conscience today
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <SocialAuthButton
                        provider="google"
                        onClick={() => handleOAuthSignUp("google")}
                        isLoading={isLoading === "google"}
                    >
                        Sign up with Google
                    </SocialAuthButton>
                    <SocialAuthButton
                        provider="github"
                        onClick={() => handleOAuthSignUp("github")}
                        isLoading={isLoading === "github"}
                    >
                        Sign up with GitHub
                    </SocialAuthButton>
                </CardContent>
            </Card>
            <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/sign-in" className="text-blue-400 hover:underline font-medium">
                    Sign in
                </Link>
            </p>
        </div>
    );
}

export default function SignUp() {
    return (
        <Suspense>
            <SignUpContent />
        </Suspense>
    );
}
