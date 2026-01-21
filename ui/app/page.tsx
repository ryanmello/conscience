"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Workflow,
  Sparkles,
  Calculator,
  FileText,
  MessageSquare,
  ArrowRight,
  Clock,
  Bot,
  LogOut,
  Settings,
  User,
  Sun,
  Moon,
  Mic,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const examplePrompts = [
  {
    title: "Math Calculator",
    description: "Basic arithmetic operations",
    prompt:
      "Create an agent that takes two numbers and an operation (add, subtract, multiply, divide) and returns the result",
    icon: Calculator,
  },
  {
    title: "Text Summarizer",
    description: "Condense long text into key points",
    prompt:
      "Create an agent that takes a long piece of text and summarizes it into 3-5 bullet points highlighting the key information",
    icon: FileText,
  },
  {
    title: "Sentiment Analyzer",
    description: "Analyze text for emotional tone",
    prompt:
      "Create an agent that analyzes text input and returns the sentiment (positive, negative, neutral) along with a confidence score",
    icon: MessageSquare,
  },
];

// Mock data for previous agents - will be replaced with real data from API
const previousAgents = [
  {
    id: "1",
    name: "Math Agent",
    description: "Performs basic arithmetic operations",
    createdAt: "2 days ago",
  },
  {
    id: "2",
    name: "Email Classifier",
    description: "Categorizes emails by priority and type",
    createdAt: "5 days ago",
  },
  {
    id: "3",
    name: "Data Formatter",
    description: "Converts data between JSON, CSV, and XML formats",
    createdAt: "1 week ago",
  },
];

interface UserData {
  email?: string;
  user_metadata?: {
    avatar_url?: string;
    full_name?: string;
    name?: string;
    user_name?: string;
  };
}

export default function Page() {
  const [prompt, setPrompt] = React.useState("");
  const [user, setUser] = React.useState<UserData | null>(null);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const supabase = createClient();

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, [supabase.auth]);

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
  };

  const handleGenerate = () => {
    // TODO: Implement agent generation
    console.log("Generating agent with prompt:", prompt);
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      router.push("/sign-in");
      router.refresh();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Get user display info from metadata
  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.user_name ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Workflow size={24} />
            <span className="text-lg font-semibold">Conscience</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            {mounted && (
              <Button variant="ghost" onClick={toggleTheme} aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
                {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
            )}


            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="cursor-pointer flex items-center gap-2 rounded-full ring ring-border transition-all hover:ring-ring">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <User size={18} className="text-muted-foreground" />
                      </div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{displayName}</p>
                      {user.email && (
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push("/settings")
                      }}
                    >
                      <Settings />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                    >
                      <LogOut />
                      {isSigningOut ? "Signing out..." : "Sign out"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-3xl font-semibold tracking-tight">
            What kind of agent do you want to build?
          </h1>
          <p className="text-muted-foreground">
            Describe your agent in natural language and we&apos;ll generate the
            tools and workflow for you.
          </p>
        </div>

        {/* Prompt Input */}
        <div className="mb-12">
          <div className="overflow-hidden rounded-2xl border border-border bg-card ring-1 ring-foreground/10">
            {/* Textarea */}
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Create an agent that..."
              className="min-h-28 resize-none border-0 bg-transparent px-4 py-4 text-base ring-0 focus-visible:border-0 focus-visible:ring-0"
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              spellCheck={false}
              autoComplete="off"
            />
            {/* Footer Bar */}
            <div className="flex items-center justify-between border-t border-border/50 bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-1">
                {/* Model Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
                      <Bot size={16} />
                      <span className="text-xs">GPT-4o</span>
                      <ChevronDown size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Select Model</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Bot size={16} />
                      GPT-4o
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Bot size={16} />
                      GPT-4o Mini
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Bot size={16} />
                      Claude 3.5 Sonnet
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mic Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground"
                  aria-label="Voice input"
                >
                  <Mic size={16} />
                </Button>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                size="sm"
                className="h-8"
              >
                <Sparkles size={14} data-icon="inline-start" />
                Generate
              </Button>
            </div>
          </div>
        </div>

        {/* Example Prompts */}
        <div className="mb-12 text-center">
          <p className="mb-4 text-sm text-muted-foreground">Not sure where to start? Try one of these:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {examplePrompts.map((example) => (
              <button
                key={example.title}
                onClick={() => handleExampleClick(example.prompt)}
                className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-muted"
              >
                <example.icon size={14} className="text-muted-foreground" />
                {example.title}
              </button>
            ))}
          </div>
        </div>

        {/* Previous Agents */}
        <div>
          <h2 className="mb-4 text-lg font-medium">Your agents</h2>
          {previousAgents.length > 0 ? (
            <div className="space-y-2">
              {previousAgents.map((agent) => (
                <button
                  key={agent.id}
                  className="cursor-pointer group w-full text-left"
                  onClick={() => {
                    // TODO: Navigate to agent
                    console.log("Open agent:", agent.id);
                  }}
                >
                  <Card size="sm" className="hover:bg-muted">
                    <CardContent className="flex items-center gap-4 py-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Bot size={18} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agent.name}</span>
                          <ArrowRight
                            size={14}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {agent.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={12} />
                        {agent.createdAt}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Bot size={24} className="text-muted-foreground" />
                </div>
                <p className="mb-1 font-medium">No agents yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first agent by describing what you want it to do
                  above.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
