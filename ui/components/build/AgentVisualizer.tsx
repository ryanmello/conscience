import { Bot, ChevronRight } from "lucide-react";

export default function AgentVisualizer() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-card p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Simple visual representation */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-16 rounded-xl border-2 border-dashed border-blue-500/50 bg-blue-500/10 flex items-center justify-center">
              <span className="text-xs text-blue-500 font-medium">Input</span>
            </div>
          </div>
          <ChevronRight className="text-muted-foreground" />
          <div className="flex flex-col items-center gap-2">
            <div className="w-32 h-20 rounded-xl border-2 border-green-500 bg-green-500/10 flex items-center justify-center">
              <Bot size={24} className="text-green-500" />
            </div>
            <span className="text-xs text-muted-foreground">Agent</span>
          </div>
          <ChevronRight className="text-muted-foreground" />
          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-16 rounded-xl border-2 border-dashed border-purple-500/50 bg-purple-500/10 flex items-center justify-center">
              <span className="text-xs text-purple-500 font-medium">
                Output
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Agent visualization will appear here during execution
        </p>
      </div>
    </div>
  );
}
