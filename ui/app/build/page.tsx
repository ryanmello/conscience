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
  ChevronUp,
  Loader2,
  Download,
  User,
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
import { generatePlan, GeneratePlanResult } from "../../actions/generate-plan";
import { getModels } from "../../actions/get_models";
import { toast } from "sonner";
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

// Message types for the chat
type Message = 
  | { type: "user"; content: string }
  | { type: "loading" }
  | { type: "response"; plan: GeneratePlanResult; isExpanded: boolean };

export default function BuildPage() {
  const [prompt, setPrompt] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [models, setModels] = React.useState<string[] | null>(null);
  const [selectedModel, setSelectedModel] = React.useState<string>("Opus 4.5");
  const [isLoadingModels, setIsLoadingModels] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Track if we're in chat mode (has messages)
  const isChatMode = messages.length > 0;

  // Track if user is actively typing (has content in textarea)
  const isTyping = prompt.length > 0;

  // Track animation phase: 'idle' -> 'fading-bottom' -> 'sliding' -> 'fading-top' -> 'complete'
  const [animationPhase, setAnimationPhase] = React.useState<'idle' | 'fading-bottom' | 'sliding' | 'fading-top' | 'complete'>('idle');

  // Scroll to bottom when messages change
  React.useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  React.useEffect(() => {
    if (isTyping || isChatMode) {
      // Phase 1: Fade out bottom sections (Try an example + Your agents)
      setAnimationPhase('fading-bottom');

      // Phase 2: After bottom fades, slide textarea down
      const slideTimer = setTimeout(() => {
        setAnimationPhase('sliding');
      }, 400);

      // Phase 3: After sliding, fade out the heading
      const fadeTopTimer = setTimeout(() => {
        setAnimationPhase('fading-top');
      }, 400);

      // Phase 4: After heading fades, collapse its height
      const completeTimer = setTimeout(() => {
        setAnimationPhase('complete');
      }, 1400);

      return () => {
        clearTimeout(slideTimer);
        clearTimeout(fadeTopTimer);
        clearTimeout(completeTimer);
      };
    } else {
      setAnimationPhase('idle');
    }
  }, [isTyping, isChatMode]);

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

    const userMessage = prompt.trim();
    setPrompt("");
    
    // Add user message and loading state
    setMessages(prev => [
      ...prev,
      { type: "user", content: userMessage },
      { type: "loading" }
    ]);

    setIsLoading(true);
    try {
      const result = await generatePlan(userMessage);

      if (result.success && result.data) {
        const plan = result.data;
        // Replace loading with response
        setMessages(prev => [
          ...prev.filter(m => m.type !== "loading"),
          { type: "response", plan, isExpanded: false }
        ]);
      } else {
        // Remove loading on error
        setMessages(prev => prev.filter(m => m.type !== "loading"));
        toast.error("Error: " + result.error);
      }
    } catch (error) {
      console.error("Error generating plan:", error);
      setMessages(prev => prev.filter(m => m.type !== "loading"));
      toast.error("Failed to generate plan");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (index: number) => {
    setMessages(prev => prev.map((msg, i) => {
      if (i === index && msg.type === "response") {
        return { ...msg, isExpanded: !msg.isExpanded };
      }
      return msg;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const isAnimating = animationPhase !== 'idle';
  const isSliding = animationPhase === 'sliding' || animationPhase === 'fading-top' || animationPhase === 'complete';

  return (
    <div className={cn(
      "bg-background flex flex-col transition-all duration-1000 ease-out h-screen overflow-hidden"
    )}>
      <Header />

      {/* Main Content */}
      <main className={cn(
        "mx-auto w-full max-w-3xl px-4 flex-1 flex flex-col relative transition-all duration-700 ease-out overflow-hidden",
        isSliding || isChatMode ? "pb-4" : "py-16"
      )}>
        {/* Hero Section - Fades out when typing or in chat mode */}
        <div
          className={cn(
            "text-center overflow-hidden shrink-0",
            animationPhase === 'fading-top' || animationPhase === 'complete' || isChatMode
              ? "opacity-0 pointer-events-none"
              : "opacity-100",
            animationPhase === 'complete' || isChatMode ? "h-0 mb-0" : "mb-10",
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

        {/* Chat Messages Area - Shows when in chat mode */}
        {isChatMode && (
          <div className="flex-1 overflow-y-auto mb-4 space-y-4 pt-4">
            {messages.map((message, index) => {
              if (message.type === "user") {
                return (
                  <div key={index} className="flex justify-end">
                    <div className="flex items-start gap-3 max-w-[80%]">
                      <div className="bg-blue-500 text-white px-4 py-3 rounded-md">
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/20">
                        <User size={16} className="text-blue-500" />
                      </div>
                    </div>
                  </div>
                );
              }

              if (message.type === "loading") {
                return (
                  <div key={index} className="flex justify-start">
                    <div className="flex items-start gap-3 max-w-[80%]">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-500/20">
                        <Bot size={16} className="text-green-500" />
                      </div>
                      <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-md">
                        <div className="flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Generating your plan...</span>
                        </div>
                        <div className="mt-2 space-y-2">
                          <div className="h-3 bg-muted rounded animate-pulse w-48" />
                          <div className="h-3 bg-muted rounded animate-pulse w-36" />
                          <div className="h-3 bg-muted rounded animate-pulse w-52" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (message.type === "response") {
                return (
                  <div key={index} className="flex justify-start">
                    <div className="flex items-start gap-3 max-w-[85%] w-full">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-500/20">
                        <Bot size={16} className="text-green-500" />
                      </div>
                      <div className="flex-1">
                        {/* Collapsible Card */}
                        <div className="bg-card border border-border rounded-md overflow-hidden transition-all">
                          {/* Card Header - Always visible, clickable */}
                          <button
                            onClick={() => toggleExpand(index)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
                                <FileText size={18} className="text-green-500" />
                              </div>
                              <div className="text-left">
                                <p className="font-medium text-sm">{message.plan.title}</p>
                                <p className="text-xs text-muted-foreground">Click to {message.isExpanded ? "collapse" : "expand"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={message.plan.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-muted hover:bg-muted/80 transition-colors"
                              >
                                <Download size={12} />
                                Download
                              </a>
                              {message.isExpanded ? (
                                <ChevronUp size={18} className="text-muted-foreground" />
                              ) : (
                                <ChevronDown size={18} className="text-muted-foreground" />
                              )}
                            </div>
                          </button>

                          {/* Expanded Content */}
                          {message.isExpanded && (
                            <div className="border-t border-border">
                              <div className="p-4 max-h-96 overflow-y-auto scrollbar-textarea">
                                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono rounded-xl">
                                  {message.plan.content}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Input Box Container */}
        <div
          className={cn(
            "transition-all duration-1000 ease-out shrink-0",
            isSliding || isChatMode
              ? "mt-auto"
              : "mb-10"
          )}
        >
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
            {/* Textarea */}
            <div className="px-5 py-4">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
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

        {/* Example Prompts - Chips - Fades out when typing or in chat mode */}
        <div
          className={cn(
            "text-center overflow-hidden shrink-0",
            isAnimating || isChatMode ? "opacity-0 pointer-events-none" : "opacity-100",
            isSliding || isChatMode ? "h-0" : "mb-16",
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

        {/* Previous Agents - Fades out when typing or in chat mode */}
        <div
          className={cn(
            "overflow-hidden shrink-0",
            isAnimating || isChatMode ? "opacity-0 pointer-events-none" : "opacity-100",
            isSliding || isChatMode ? "h-0" : "",
            "transition-all duration-1000 ease-out"
          )}
        >
          <h2 className="mb-5 text-xl font-normal">
            Your <span className="text-green-500">agents</span>
          </h2>
          {previousAgents.length > 0 ? (
            <div className="space-y-3">
              {previousAgents.map((agent, index) => {
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
