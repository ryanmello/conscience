'use client';

import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { CheckCircle, AlertCircle, Clock, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ExecutionStatus = 'pending' | 'queued' | 'executing' | 'completed' | 'failed';

export type BaseNodeData = {
  label: string;
  description?: string;
  icon?: LucideIcon;
  executionStatus?: ExecutionStatus;
  duration?: number;
  error?: string;
};

export type BaseNodeType = Node<BaseNodeData>;

interface BaseNodeProps extends NodeProps<BaseNodeType> {
  accentColor: string;
  hasInput?: boolean;
  hasOutput?: boolean;
}

export default function BaseNode({
  data,
  selected,
  accentColor,
  hasInput = true,
  hasOutput = true,
}: BaseNodeProps) {
  const status = data.executionStatus || 'pending';
  const Icon = data.icon;

  const getNodeStyles = () => {
    const baseClasses = "rounded-lg border-2 px-4 py-3 shadow-lg min-w-[180px] transition-all duration-300";

    switch (status) {
      case 'executing':
        return cn(baseClasses, "border-blue-500 bg-blue-500/10 shadow-blue-500/20 animate-pulse");
      case 'completed':
        return cn(baseClasses, "border-green-500 bg-green-500/10 shadow-green-500/20");
      case 'failed':
        return cn(baseClasses, "border-red-500 bg-red-500/10 shadow-red-500/20");
      case 'queued':
        return cn(baseClasses, "border-orange-400 bg-orange-400/10 shadow-orange-400/20 animate-pulse");
      default:
        return cn(
          baseClasses,
          selected
            ? `${accentColor} shadow-lg`
            : "border-border bg-card"
        );
    }
  };

  const getStatusIndicator = () => {
    switch (status) {
      case 'executing':
        return (
          <div className="absolute -top-2 -left-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
            <Loader2 className="w-3 h-3 text-white animate-spin" />
          </div>
        );
      case 'completed':
        return (
          <div className="absolute -top-2 -left-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md">
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
        );
      case 'failed':
        return (
          <div className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-md">
            <AlertCircle className="w-3 h-3 text-white" />
          </div>
        );
      case 'queued':
        return (
          <div className="absolute -top-2 -left-2 w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center shadow-md">
            <Clock className="w-3 h-3 text-white" />
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'executing':
        return <span className="text-blue-400">Running...</span>;
      case 'completed':
        return <span className="text-green-400">Completed</span>;
      case 'failed':
        return <span className="text-red-400">Failed</span>;
      case 'queued':
        return <span className="text-orange-400">Queued</span>;
      default:
        return null;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className={getNodeStyles()} title={data.error ? `Error: ${data.error}` : undefined}>
      {getStatusIndicator()}

      {/* Duration Badge */}
      {data.duration && status === 'completed' && (
        <div className="absolute -top-2 right-2 px-2 py-0.5 bg-muted text-foreground text-xs rounded-full shadow-md">
          {formatDuration(data.duration)}
        </div>
      )}

      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-4 h-4 bg-green-400 border-2 border-background -left-2 hover:bg-green-500 hover:scale-110 transition-all"
        />
      )}

      <div className="flex items-center gap-3">
        {Icon && (
          <div className="shrink-0">
            <Icon className={cn("w-5 h-5", accentColor.replace('border-', 'text-').replace('/50', ''))} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {data.label}
          </div>
          {data.description && (
            <div className="text-xs text-muted-foreground truncate">
              {data.description}
            </div>
          )}
          {status !== 'pending' && (
            <div className="text-xs font-medium mt-1">
              {getStatusText()}
            </div>
          )}
        </div>
      </div>

      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-4 h-4 bg-blue-400 border-2 border-background -right-2 hover:bg-blue-500 hover:scale-110 transition-all"
        />
      )}
    </div>
  );
}
