import { AlertCircle, ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";

type ErrorType = "not_found" | "unauthorized";

interface AgentNotFoundProps {
  errorType?: ErrorType;
  agentId?: string;
}

export default function AgentNotFound({ 
  errorType = "not_found",
  agentId 
}: AgentNotFoundProps) {
  const isUnauthorized = errorType === "unauthorized";

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
          isUnauthorized 
            ? "bg-yellow-500/10" 
            : "bg-red-500/10"
        }`}>
          {isUnauthorized ? (
            <Lock size={28} className="text-yellow-500" />
          ) : (
            <AlertCircle size={28} className="text-red-500" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {isUnauthorized ? "Access Denied" : "Agent Not Found"}
          </h1>
          <p className="text-muted-foreground">
            {isUnauthorized 
              ? "You don't have permission to access this agent. Please make sure you're signed in with the correct account."
              : `The agent${agentId ? ` (${agentId})` : ""} you're looking for doesn't exist or may have been deleted.`
            }
          </p>
        </div>

        <Link href="/build">
          <Button variant="outline" className="gap-2">
            <ArrowLeft size={16} />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
