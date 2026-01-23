"use client";

import * as React from "react";
import {
  Sparkles,
  Search,
  FileText,
  MessageSquare,
  ArrowRight,
  Clock,
  Bot,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Header } from "@/components/Header";
import { MicButton } from "@/components/MicButton";
import { processInput } from "../../actions/process-input";
import { getModels } from "../../actions/get_models";
import { toast } from "sonner"
import { cn } from "@/lib/utils";

const examplePrompts = [
  {
    title: "Research Assistant",
    description: "Find and compile information",
    prompt:
      "Create an agent that takes a topic and searches multiple sources to compile a comprehensive research summary with citations",
    icon: Search,
    colorClass: "text-blue-500",
  },
  {
    title: "Text Summarizer",
    description: "Condense long text into key points",
    prompt:
      "Create an agent that takes a long piece of text and summarizes it into 3-5 bullet points highlighting the key information",
    icon: FileText,
    colorClass: "text-red-500",
  },
  {
    title: "Sentiment Analyzer",
    description: "Analyze text for emotional tone",
    prompt:
      "Create an agent that analyzes text input and returns the sentiment (positive, negative, neutral) along with a confidence score",
    icon: MessageSquare,
    colorClass: "text-green-500",
  },
];

// Mock data for previous agents - will be replaced with real data from API
const previousAgents = [
  {
    id: "1",
    name: "Research Assistant",
    description: "Searches and compiles information from multiple sources",
    createdAt: "2 days ago",
  },
  {
    id: "2",
    name: "Data Formatter",
    description: "Converts data between JSON, CSV, and XML formats",
    createdAt: "1 week ago",
  },
];

export default function BuildPage() {
  const [prompt, setPrompt] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [models, setModels] = React.useState<string[] | null>(null);
  const [selectedModel, setSelectedModel] = React.useState<string>("Opus 4.5");
  const [isLoadingModels, setIsLoadingModels] = React.useState(false);

  // Track if user is actively typing (has content in textarea)
  const isTyping = prompt.length > 0;

  // Track animation phase: 'idle' -> 'fading-bottom' -> 'sliding' -> 'fading-top' -> 'complete'
  // 1. Fade out "Try an example" and "Your agents" sections
  // 2. Slide textarea down to the bottom
  // 3. Fade out the "Build an AI agent" heading
  // 4. Collapse the heading height after fade completes
  const [animationPhase, setAnimationPhase] = React.useState<'idle' | 'fading-bottom' | 'sliding' | 'fading-top' | 'complete'>('idle');

  React.useEffect(() => {
    if (isTyping) {
      // Phase 1: Fade out bottom sections (Try an example + Your agents)
      setAnimationPhase('fading-bottom');

      // Phase 2: After bottom fades, slide textarea down
      const slideTimer = setTimeout(() => {
        setAnimationPhase('sliding');
      }, 400);

      // Phase 3: After sliding, fade out the heading
      const fadeTopTimer = setTimeout(() => {
        setAnimationPhase('fading-top');
      }, 400); // 400ms for fade + 500ms for slide

      // Phase 4: After heading fades, collapse its height
      const completeTimer = setTimeout(() => {
        setAnimationPhase('complete');
      }, 1400); // 900ms + 500ms for fade

      return () => {
        clearTimeout(slideTimer);
        clearTimeout(fadeTopTimer);
        clearTimeout(completeTimer);
      };
    } else {
      // When clearing input, reverse immediately
      setAnimationPhase('idle');
    }
  }, [isTyping]);

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
  };

  const handleDropdownOpenChange = async (open: boolean) => {
    if (open && models === null) {
      setIsLoadingModels(true);
      try {
        const result = await getModels();
        if (result.success && result.data) {
          setModels(result.data);
        } else {
          toast.error(result.error || "Failed to load models");
        }
      } catch (error) {
        console.error("Error fetching models:", error);
        toast.error("Failed to load models");
      } finally {
        setIsLoadingModels(false);
      }
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    try {
      const result = await processInput(prompt);

      if (result.success) {
        toast.success("API Response: " + result.data.output);
      } else {
        toast.error("Error: " + result.error);
      }
    } catch (error) {
      console.error("Error calling API:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAnimating = animationPhase !== 'idle';
  const isSliding = animationPhase === 'sliding' || animationPhase === 'fading-top' || animationPhase === 'complete';

  return (
    <div className={cn(
      "bg-background flex flex-col transition-all duration-1000 ease-out",
      isSliding ? "h-screen overflow-hidden" : "min-h-screen"
    )}>
      <Header />

      {/* Main Content */}
      <main className={cn(
        "mx-auto w-full max-w-3xl px-4 flex-1 flex flex-col relative transition-all duration-700 ease-out",
        isSliding ? "pb-4" : "py-16"
      )}>
        {/* Hero Section - Fades out LAST */}
        <div
          className={cn(
            "text-center overflow-hidden",
            // Fade happens in fading-top phase
            animationPhase === 'fading-top' || animationPhase === 'complete'
              ? "opacity-0 pointer-events-none"
              : "opacity-100",
            // Height collapse happens AFTER fade completes (in 'complete' phase)
            animationPhase === 'complete' ? "h-0 mb-0" : "mb-10",
            // Transition timing
            "transition-all duration-400 ease-out"
          )}
        >
          <h1 className="mb-4 text-4xl font-normal tracking-tight">
            Build an <span className="text-blue-500">AI agent</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Describe what you want and we&apos;ll create it for you
          </p>
        </div>

        {/* Input Box Container - Expands to push content down when typing */}
        <div
          className={cn(
            "transition-all duration-1000 ease-out",
            // Expand after bottom sections have faded (sliding phase onwards)
            isSliding
              ? "flex-1 flex flex-col justify-end"
              : "mb-10"
          )}
        >
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
            {/* Textarea */}
            <div className="px-5 py-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Create an agent that..."
                className="min-h-24 max-h-64 resize-none border-none bg-transparent p-0 text-base shadow-none ring-0 focus-visible:border-none focus-visible:ring-0 focus-visible:shadow-none rounded-none placeholder:text-muted-foreground/60 overflow-y-auto scrollbar-textarea"
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            {/* Footer Bar */}
            <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-1">
                {/* Model Selector */}
                <DropdownMenu onOpenChange={handleDropdownOpenChange}>
                  <DropdownMenuTrigger asChild>
                    <button className="cursor-pointer flex h-9 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-0">
                      <Bot size={16} />
                      <span>{selectedModel}</span>
                      <ChevronDown size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="rounded-xl min-w-[180px]">
                    <DropdownMenuLabel>Select Model</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isLoadingModels ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={20} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : models && models.length > 0 ? (
                      models.map((model) => (
                        <DropdownMenuItem
                          key={model}
                          className="rounded-lg cursor-pointer"
                          onClick={() => setSelectedModel(model)}
                        >
                          <Bot size={16} />
                          {model}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No models available
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mic Button */}
                <MicButton setPrompt={setPrompt} />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isLoading}
                className="cursor-pointer flex h-9 items-center gap-2 rounded-full bg-blue-500 px-5 text-sm font-medium text-white transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <Sparkles size={16} className={isLoading ? "animate-spin" : ""} />
                {isLoading ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>

        {/* Example Prompts - Chips - Fades out FIRST */}
        <div
          className={cn(
            "text-center overflow-hidden",
            // Fade happens immediately when typing starts (fading-bottom and onwards)
            isAnimating ? "opacity-0 pointer-events-none" : "opacity-100",
            // Height collapse happens when sliding starts
            isSliding ? "h-0" : "mb-16",
            // Transition timing
            "transition-all duration-1000 ease-out"
          )}
        >
          <p className="mb-4 text-sm text-muted-foreground">Try an example</p>
          <div className="flex flex-wrap justify-center gap-3">
            {examplePrompts.map((example) => (
              <button
                key={example.title}
                onClick={() => handleExampleClick(example.prompt)}
                className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm transition-all hover:shadow-md"
              >
                <example.icon size={16} className={example.colorClass} />
                {example.title}
              </button>
            ))}
          </div>
        </div>

        {/* Previous Agents - Fades out FIRST */}
        <div
          className={cn(
            "overflow-hidden",
            // Fade happens immediately when typing starts (fading-bottom and onwards)
            isAnimating ? "opacity-0 pointer-events-none" : "opacity-100",
            // Height collapse happens when sliding starts
            isSliding ? "h-0" : "",
            // Transition timing
            "transition-all duration-1000 ease-out"
          )}
        >
          <h2 className="mb-5 text-xl font-normal">
            Your <span className="text-green-500">agents</span>
          </h2>
          {previousAgents.length > 0 ? (
            <div className="space-y-3">
              {previousAgents.map((agent, index) => {
                // Cycle through colors for visual interest
                const colorVariants = [
                  { bg: "bg-blue-500/10", text: "text-blue-500" },
                  { bg: "bg-red-500/10", text: "text-red-500" },
                  { bg: "bg-yellow-500/10", text: "text-yellow-500" },
                  { bg: "bg-green-500/10", text: "text-green-500" },
                ];
                const colorVariant = colorVariants[index % colorVariants.length];

                return (
                  <button
                    key={agent.id}
                    className="cursor-pointer group w-full text-left"
                    onClick={() => {
                      // TODO: Navigate to agent
                      console.log("Open agent:", agent.id);
                    }}
                  >
                    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colorVariant.bg}`}>
                        <Bot size={22} className={colorVariant.text} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agent.name}</span>
                          <ArrowRight
                            size={14}
                            className={`opacity-0 transition-opacity group-hover:opacity-100 ${colorVariant.text}`}
                          />
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {agent.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock size={14} />
                        {agent.createdAt}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-500/15">
                <Bot size={32} className="text-yellow-500" />
              </div>
              <p className="mb-1 text-lg font-medium">No agents yet</p>
              <p className="text-sm text-muted-foreground">
                Describe what you want to build above
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
