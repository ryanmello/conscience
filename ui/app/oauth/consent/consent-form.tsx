"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

interface ConsentFormProps {
  authorizationId: string;
  clientName: string;
  redirectUri: string;
  scopes: string[];
  userEmail?: string;
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: "Verify your identity",
  email: "View your email address",
  profile: "View your profile information",
  phone: "View your phone number",
};

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ConsentForm({
  authorizationId,
  clientName,
  redirectUri,
  scopes,
  userEmail,
}: ConsentFormProps) {
  const [isLoading, setIsLoading] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleDecision = async (decision: "approve" | "deny") => {
    try {
      setIsLoading(decision);
      setError(null);

      if (decision === "approve") {
        const { data, error } =
          await supabase.auth.oauth.approveAuthorization(authorizationId);

        if (error) {
          setError(error.message);
          setIsLoading(null);
          return;
        }

        // Redirect back to the client with authorization code
        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
        }
      } else {
        const { data, error } =
          await supabase.auth.oauth.denyAuthorization(authorizationId);

        if (error) {
          setError(error.message);
          setIsLoading(null);
          return;
        }

        // Redirect back to the client with error
        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setIsLoading(null);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
          <ShieldIcon className="size-6" />
        </div>
        <CardTitle className="text-xl">Authorize {clientName}</CardTitle>
        <CardDescription>
          This application is requesting access to your account
          {userEmail && (
            <span className="text-foreground mt-1 block font-medium">
              {userEmail}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {scopes.length > 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm font-medium">
              This will allow {clientName} to:
            </p>
            <ul className="space-y-2">
              {scopes.map((scope) => (
                <li
                  key={scope}
                  className="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2"
                >
                  <CheckIcon className="text-primary size-4 shrink-0" />
                  <span className="text-sm">
                    {SCOPE_DESCRIPTIONS[scope] || scope}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-border space-y-1 border-t pt-4">
          <p className="text-muted-foreground text-xs">
            <strong>Redirect URI:</strong>{" "}
            <span className="break-all">{redirectUri}</span>
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => handleDecision("deny")}
          disabled={isLoading !== null}
        >
          {isLoading === "deny" ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            "Deny"
          )}
        </Button>
        <Button
          className="flex-1"
          onClick={() => handleDecision("approve")}
          disabled={isLoading !== null}
        >
          {isLoading === "approve" ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            "Authorize"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
