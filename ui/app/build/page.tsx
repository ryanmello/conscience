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
  Send,
  Check,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getModels } from "../../actions/get-models";
import { approvePlan } from "../../actions/approve-plan";
import { getAgents, AgentSummary } from "../../actions/get-agents";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePlanWebSocket, ChatMessage } from "@/hooks/usePlanWebSocket";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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


// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
}


export default function BuildPage() {
  const router = useRouter()
  
  const [prompt, setPrompt] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [models, setModels] = useState<string[] | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("Opus 4.5");
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isDocumentExpanded, setIsDocumentExpanded] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // WebSocket hook
  const {
    connectionState,
    sessionId,
    document,
    messages,
    currentQuestions,
    currentProgress,
    thinkingStatus,
    isReadyForApproval,
    error,
    startPlan,
    sendResponse,
    disconnect,
  } = usePlanWebSocket();

  // Derived state
  const isConnecting = connectionState === "connecting";
  const isChatMode = messages.length > 0;
  const isTyping = prompt.length > 0;
  const hasCurrentQuestions = currentQuestions.length > 0;

  // Track animation phase: 'idle' -> 'fading-bottom' -> 'sliding' -> 'fading-top' -> 'complete'
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'fading-bottom' | 'sliding' | 'fading-top' | 'complete'>('idle');

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, thinkingStatus, currentQuestions]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Fetch agents on mount
  useEffect(() => {
    async function fetchAgents() {
      setIsLoadingAgents(true);
      try {
        const result = await getAgents();
        if (result.success && result.data) {
          setAgents(result.data.agents);
        } else {
          console.error("Failed to fetch agents:", result.error);
        }
      } catch (err) {
        console.error("Error fetching agents:", err);
      } finally {
        setIsLoadingAgents(false);
      }
    }
    fetchAgents();
  }, []);

  // Animation effect - triggers on typing OR entering chat mode
  useEffect(() => {
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
    const userPrompt = prompt.trim();
    setPrompt("");
    await startPlan(userPrompt);
  };

  const handleSendAnswer = () => {
    if (!answerInput.trim() || !hasCurrentQuestions) return;
    sendResponse(answerInput.trim());
    setAnswerInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleAnswerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendAnswer();
    }
  };

  const handleApprove = async () => {
    if (!document || !sessionId) return;

    setIsApproving(true);
    disconnect();

    try {
      const result = await approvePlan({
        plan_id: sessionId,
        title: document.title,
        content: document.content,
        version: document.version,
      });

      if (result.success && result.data) {
        if (result.data.agent_id) {
          router.push(`/build/${result.data.agent_id}`);
        }
      } else {
        toast.error(result.error || "Failed to approve plan");
      }
    } catch (err) {
      console.error("Error approving plan:", err);
      toast.error("Failed to approve plan");
    } finally {
      setIsApproving(false);
    }
  };

  const isAnimating = animationPhase !== 'idle';
  const isSliding = animationPhase === 'sliding' || animationPhase === 'fading-top' || animationPhase === 'complete';

  // Render a chat message
  const renderMessage = (message: ChatMessage, index: number) => {
    if (message.type === "user_prompt" || message.type === "user_answer") {
      return (
        <div key={index} className="flex justify-end">
          <div className="flex items-start gap-3 max-w-[80%]">
            <div className="bg-blue-500 text-white px-4 py-3 rounded-2xl rounded-tr-md">
              <p className="text-sm">{message.content}</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/20">
              <User size={16} className="text-blue-500" />
            </div>
          </div>
        </div>
      );
    }

    if (message.type === "questions") {
      return (
        <div key={index} className="flex justify-start">
          <div className="flex items-start gap-3 max-w-[80%]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-500/20">
              <Bot size={16} className="text-green-500" />
            </div>
            <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-md space-y-2">
              {message.questions.map((q, qIndex) => (
                <p key={q.id || qIndex} className="text-sm">
                  {message.questions.length > 1 ? `${qIndex + 1}. ` : ""}{q.text}
                </p>
              ))}
              <p className="text-xs text-muted-foreground">
                Round {message.progress.round} of {message.progress.max_rounds}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={cn(
      "bg-background flex flex-col transition-all duration-1000 ease-out",
      isSliding || isChatMode ? "h-screen overflow-hidden" : "min-h-screen"
    )}>
      <Header />

      {/* Main Content */}
      <main className={cn(
        "mx-auto w-full max-w-3xl px-4 flex-1 flex flex-col relative transition-all duration-700 ease-out",
        isSliding || isChatMode ? "pb-4 min-h-0" : "py-16"
      )}>
        {/* Hero Section - Fades out LAST */}
        <div
          className={cn(
            "text-center overflow-hidden",
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

        {/* Chat Messages Area - Shows wheFn in chat mode */}
        {isChatMode && (
          <div className="flex-1 min-h-0 relative">
            {/* Top fade overlay */}
            {/* <div className="pointer-events-none absolute top-0 left-0 right-0 h-12 bg-linear-to-b from-background to-transparent z-10" /> */}
            <div className={cn("h-full overflow-y-auto space-y-4 pt-6 pb-4 scrollbar-hide")}>
              {messages.map((message, index) => renderMessage(message, index))}

              {/* Thinking indicator */}
              {thinkingStatus && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3 max-w-[80%]">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-500/20">
                      <Loader2 size={16} className="text-green-500 animate-spin" />
                    </div>
                    <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-md">
                      <p className="text-sm text-muted-foreground">{thinkingStatus.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Current questions waiting for response */}
              {hasCurrentQuestions && currentProgress && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3 max-w-[80%]">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-500/20">
                      <Bot size={16} className="text-green-500" />
                    </div>
                    <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-tl-md space-y-2">
                      {currentQuestions.map((q, qIndex) => (
                        <p key={q.id || qIndex} className="text-sm">
                          {currentQuestions.length > 1 ? `${qIndex + 1}. ` : ""}{q.text}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* Document Panel - Shows when document exists */}
        {document && (
          <div className="mb-4 shrink-0">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsDocumentExpanded(!isDocumentExpanded)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsDocumentExpanded(!isDocumentExpanded); }}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
                    <FileText size={18} className="text-green-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{document.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Version {document.version} • Click to {isDocumentExpanded ? "collapse" : "expand"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {document.url && (
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <Download size={12} />
                      Download
                    </a>
                  )}
                  {isReadyForApproval && (
                    <Button
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); handleApprove(); }}
                      disabled={isApproving}
                      className="bg-green-500 text-white hover:bg-green-600"
                    >
                      {isApproving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      {isApproving ? "Approving..." : "Approve"}
                    </Button>
                  )}
                  {isDocumentExpanded ? (
                    <ChevronDown size={18} className="text-muted-foreground" />
                  ) : (
                    <ChevronUp size={18} className="text-muted-foreground" />
                  )}
                </div>
              </div>
              {isDocumentExpanded && (
                <div className="border-t border-border">
                  <div className="p-4 max-h-[40vh] overflow-y-auto scrollbar-textarea">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
                      {document.content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Box Container - Expands to push content down when typing */}
        <div
          className={cn(
            !isChatMode && "transition-all duration-1000 ease-out shrink-0",
            isChatMode
              ? "" // In chat mode, don't expand - let chat messages take the space
              : isSliding
                ? "flex-1 flex flex-col justify-end" // During animation, expand to push down
                : "mb-10" // Initial state with margin
          )}
        >
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
            {/* Textarea */}
            <div className="px-5 py-4">
              <Textarea
                value={isChatMode ? answerInput : prompt}
                onChange={(e) => isChatMode ? setAnswerInput(e.target.value) : setPrompt(e.target.value)}
                onKeyDown={isChatMode ? handleAnswerKeyDown : handleKeyDown}
                placeholder={isChatMode
                  ? (hasCurrentQuestions ? "Type your answer..." : "Waiting for response...")
                  : "Create an agent that..."
                }
                disabled={isChatMode && !hasCurrentQuestions}
                className="min-h-24 max-h-64 resize-none border-none bg-transparent p-0 text-base shadow-none ring-0 focus-visible:border-none focus-visible:ring-0 focus-visible:shadow-none rounded-none placeholder:text-muted-foreground/60 overflow-y-auto scrollbar-textarea disabled:opacity-50 disabled:cursor-not-allowed"
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
                <MicButton setPrompt={isChatMode ? setAnswerInput : setPrompt} />
              </div>

              {/* Action Button */}
              {isChatMode ? (
                <button
                  onClick={handleSendAnswer}
                  disabled={!answerInput.trim() || !hasCurrentQuestions}
                  className="cursor-pointer flex h-9 items-center gap-2 rounded-full bg-blue-500 px-5 text-sm font-medium text-white transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                  <Send size={16} />
                  Send
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isConnecting}
                  className="cursor-pointer flex h-9 items-center gap-2 rounded-full bg-blue-500 px-5 text-sm font-medium text-white transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                  <Sparkles size={16} className={isConnecting ? "animate-spin" : ""} />
                  {isConnecting ? "Connecting..." : "Generate"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Example Prompts - Chips - Fades out FIRST */}
        <div
          className={cn(
            "text-center overflow-hidden",
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

        {/* Previous Agents - Fades out FIRST */}
        <div
          className={cn(
            "overflow-hidden",
            isAnimating || isChatMode ? "opacity-0 pointer-events-none" : "opacity-100",
            isSliding || isChatMode ? "h-0" : "",
            "transition-all duration-1000 ease-out"
          )}
        >
          <h2 className="mb-5 text-xl font-normal">
            Your <span className="text-green-500">agents</span>
          </h2>
          {isLoadingAgents ? (
            // Loading skeleton
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  <Skeleton className="h-12 w-12 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : agents.length > 0 ? (
            <div className="space-y-3">
              {agents.map((agent, index) => {
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
                    onClick={() => router.push(`/build/${agent.id}`)}
                  >
                    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colorVariant.bg}`}>
                        <Bot size={22} className={colorVariant.text} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agent.name || agent.plan.title}</span>
                          <ArrowRight
                            size={14}
                            className={`opacity-0 transition-opacity group-hover:opacity-100 ${colorVariant.text}`}
                          />
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {agent.status}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock size={14} />
                        {formatRelativeTime(agent.created_at)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-500/15">
                <Bot size={32} className="text-yellow-500" />
              </div>
              <p className="text-lg font-medium">No agents yet</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
