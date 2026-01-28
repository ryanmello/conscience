import { cn } from "@/lib/utils";
import { Bot, MessageSquare, Send, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

export default function ChatPanel({
  messages,
  onSendMessage,
}: {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
        <MessageSquare size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Agent Chat
        </span>
        <span className="text-xs text-muted-foreground/60 ml-auto">
          Ask to modify your agent
        </span>
      </div>

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

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-border/40 bg-muted/20"
      >
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe changes to your agent..."
            className="flex-1 h-9 px-4 text-sm bg-background border border-border rounded-full focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="cursor-pointer flex h-9 items-center gap-2 rounded-full bg-blue-500 px-5 text-sm font-medium text-white transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
