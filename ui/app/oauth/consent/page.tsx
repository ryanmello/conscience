import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConsentForm } from "./consent-form";

interface ConsentPageProps {
  searchParams: Promise<{ authorization_id?: string }>;
}

export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const params = await searchParams;
  const authorizationId = params.authorization_id;

  if (!authorizationId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Error</h1>
          <p className="text-muted-foreground mt-2">
            Missing authorization_id parameter
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to sign-in, preserving authorization_id
    redirect(`/sign-in?redirect=/oauth/consent?authorization_id=${authorizationId}`);
  }

  // Get authorization details using the authorization_id
  const { data: authDetails, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !authDetails) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Error</h1>
          <p className="text-muted-foreground mt-2">
            {error?.message || "Invalid authorization request"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ConsentForm
        authorizationId={authorizationId}
        clientName={authDetails.client?.name || "Unknown Application"}
        redirectUri={authDetails.redirect_url || ""}
        scopes={authDetails.scope ? authDetails.scope.split(" ") : []}
        userEmail={user.email}
      />
    </div>
  );
}
