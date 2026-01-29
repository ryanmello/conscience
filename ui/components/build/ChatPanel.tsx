import { cn } from "@/lib/utils";
import { ArrowUp, Bot, ChevronDown, Loader2, MessageSquare, PanelRightClose, PanelRightOpen, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getModels } from "@/actions/get-models";
import { toast } from "sonner";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export const mockChatMessages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content:
      "Add an extra input field for max_results to limit how many sources are returned",
    timestamp: "10:32:00",
  },
  {
    id: "2",
    role: "assistant",
    content:
      "I've added a new `max_results` input field to the ResearchInput schema. It's an optional integer that defaults to 10. The search logic now respects this limit when returning sources.",
    timestamp: "10:32:15",
  },
];

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onCollapseChange,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("Opus 4.5");
  const [models, setModels] = useState<string[] | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className={cn(
        "flex items-center p-2 border-b border-border bg-muted/20 h-10",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-4 py-1">
            <MessageSquare size={12} className="text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Agent Chat
            </span>
          </div>
        )}
        <button
          onClick={handleToggleCollapse}
          className={cn(
            "cursor-pointer flex items-center justify-center p-2 m-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors",
            isCollapsed ? "my-1" : "mr-1"
          )}
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-4 scrollbar-textarea">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 mb-3">
                  <Sparkles size={18} className="text-blue-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Ask me to modify your agent
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  e.g. &quot;Add an input for max results&quot;
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-500/20">
                      <Bot size={16} className="text-green-500" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] px-4 py-3 text-sm",
                      message.role === "user"
                        ? "bg-blue-500 text-white rounded-2xl rounded-tr-md"
                        : "bg-card border border-border rounded-2xl rounded-tl-md"
                    )}
                  >
                    {message.content}
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/20">
                      <User size={16} className="text-blue-500" />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {/* Textarea */}
              <div className="px-4 py-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    adjustTextareaHeight();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe changes to your agent..."
                  rows={2}
                  className="w-full min-h-[60px] max-h-[150px] text-sm bg-transparent border-none resize-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground/60"
                  data-gramm="false"
                  data-gramm_editor="false"
                  data-enable-grammarly="false"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              
              {/* Footer with Model Select and Send */}
              <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-2">
                <DropdownMenu onOpenChange={handleDropdownOpenChange}>
                  <DropdownMenuTrigger asChild>
                    <button className="cursor-pointer flex h-8 items-center gap-2 rounded-full px-3 text-xs text-muted-foreground transition-colors hover:bg-muted focus:outline-none">
                      <Bot size={14} />
                      <span>{selectedModel}</span>
                      <ChevronDown size={12} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="rounded-xl min-w-[160px]">
                    {isLoadingModels ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={16} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : models && models.length > 0 ? (
                      models.map((model) => (
                        <DropdownMenuItem
                          key={model}
                          className="rounded-lg cursor-pointer text-xs"
                          onClick={() => setSelectedModel(model)}
                        >
                          <Bot size={14} />
                          {model}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                        No models available
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
