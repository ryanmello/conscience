import { createClient } from "@/lib/supabase/server";
import { Workflow } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user display name from metadata or email
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex items-center gap-2">
          <Workflow size={36} />
          <h1 className="text-4xl font-semibold tracking-tight">Conscience</h1>
        </div>

        <p className="text-muted-foreground max-w-md text-lg">
          Welcome back, <span className="text-foreground font-medium">{displayName}</span>
        </p>

        {user?.email && (
          <p className="text-muted-foreground text-sm">{user.email}</p>
        )}

        <SignOutButton />
      </div>
    </div>
  );
}
