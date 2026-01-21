'use client';

import { Play, Square, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Node, Edge } from '@xyflow/react';

interface StatusBarProps {
  nodes: Node[];
  edges: Edge[];
  isRunning: boolean;
  isCompleted: boolean;
  executionStats: {
    completed: number;
    failed: number;
    executing: number;
    total: number;
  };
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

export default function StatusBar({
  nodes,
  edges,
  isRunning,
  isCompleted,
  executionStats,
  onStart,
  onStop,
  onReset,
}: StatusBarProps) {
  const { completed, failed, executing, total } = executionStats;
  const isFinalizingState = isRunning && total > 0 && completed + failed === total && executing === 0;

  return (
    <div className="bg-card border-t border-border px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Stats */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="font-medium">Nodes: {nodes.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="font-medium">Connections: {edges.length}</span>
          </div>

          {/* Execution Progress */}
          {isRunning && (
            <>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isFinalizingState
                      ? "bg-purple-500 animate-pulse"
                      : "bg-blue-500 animate-pulse"
                  )}
                />
                <span className="font-medium text-foreground">
                  {isFinalizingState
                    ? "Finalizing..."
                    : `Progress: ${completed}/${total}`}
                </span>
              </div>
              {failed > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="font-medium text-red-400">
                    Failed: {failed}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Completed state */}
          {isCompleted && !isRunning && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="font-medium text-green-400">
                Completed: {completed}/{total}
                {failed > 0 && ` (${failed} failed)`}
              </span>
            </div>
          )}
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-3">
          {isCompleted && !isRunning && (
            <Button
              onClick={onReset}
              variant="outline"
              size="sm"
              className="bg-muted/50 hover:bg-muted"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}

          {isRunning ? (
            isFinalizingState ? (
              <Button
                disabled
                variant="outline"
                size="sm"
                className="bg-purple-500/10 border-purple-500/50 text-purple-400"
              >
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Finalizing...
              </Button>
            ) : (
              <Button
                onClick={onStop}
                variant="destructive"
                size="sm"
                className="bg-red-600 hover:bg-red-700"
              >
                <Square className="w-4 h-4 mr-2 fill-current" />
                Stop
              </Button>
            )
          ) : (
            <Button
              onClick={onStart}
              disabled={nodes.length === 0}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              Run Workflow
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
