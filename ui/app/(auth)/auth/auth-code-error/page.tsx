"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function AuthCodeError() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Authentication Error</CardTitle>
          <CardDescription>
            Something went wrong during the authentication process. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/sign-in">Back to Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
