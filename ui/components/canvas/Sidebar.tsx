'use client';

import { DragEvent } from 'react';
import { 
  Type, 
  Cog, 
  CheckCircle2, 
  Bot, 
  Search, 
  Shield, 
  GitPullRequest, 
  Database,
  Zap,
  type LucideIcon 
} from 'lucide-react';

export interface ToolType {
  id: string;
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  category: string;
}

const tools: ToolType[] = [
  // Input category
  {
    id: 'text',
    type: 'text',
    label: 'Text Input',
    description: 'Add text data',
    icon: Type,
    iconColor: 'text-foreground',
    category: 'Input',
  },
  {
    id: 'database',
    type: 'text',
    label: 'Database Query',
    description: 'Fetch from database',
    icon: Database,
    iconColor: 'text-cyan-400',
    category: 'Input',
  },
  // Processing category
  {
    id: 'process',
    type: 'process',
    label: 'Process',
    description: 'Transform data',
    icon: Cog,
    iconColor: 'text-blue-400',
    category: 'Processing',
  },
  {
    id: 'agent',
    type: 'agent',
    label: 'AI Agent',
    description: 'AI processing',
    icon: Bot,
    iconColor: 'text-purple-400',
    category: 'Processing',
  },
  {
    id: 'search',
    type: 'process',
    label: 'Search',
    description: 'Search & analyze',
    icon: Search,
    iconColor: 'text-emerald-400',
    category: 'Processing',
  },
  // Actions category
  {
    id: 'security',
    type: 'process',
    label: 'Security Scan',
    description: 'Scan for vulnerabilities',
    icon: Shield,
    iconColor: 'text-rose-400',
    category: 'Actions',
  },
  {
    id: 'git',
    type: 'process',
    label: 'Git Action',
    description: 'Git operations',
    icon: GitPullRequest,
    iconColor: 'text-slate-400',
    category: 'Actions',
  },
  // Output category
  {
    id: 'output',
    type: 'output',
    label: 'Output',
    description: 'Display results',
    icon: CheckCircle2,
    iconColor: 'text-green-400',
    category: 'Output',
  },
  {
    id: 'trigger',
    type: 'output',
    label: 'Trigger',
    description: 'Trigger next workflow',
    icon: Zap,
    iconColor: 'text-yellow-400',
    category: 'Output',
  },
];

interface SidebarProps {
  onDragStart?: (tool: ToolType) => void;
}

export default function Sidebar({ onDragStart }: SidebarProps) {
  const handleDragStart = (event: DragEvent<HTMLDivElement>, tool: ToolType) => {
    event.dataTransfer.setData('application/reactflow', tool.type);
    event.dataTransfer.setData('application/tool-id', tool.id);
    event.dataTransfer.setData('application/tool-label', tool.label);
    event.dataTransfer.setData('application/tool-description', tool.description);
    event.dataTransfer.effectAllowed = 'move';
    onDragStart?.(tool);
  };

  // Group tools by category
  const categories = Array.from(new Set(tools.map((tool) => tool.category)));

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-full">      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {category}
            </h3>
            <div className="space-y-2">
              {tools
                .filter((tool) => tool.category === category)
                .map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <div
                      key={tool.id}
                      className="flex items-start gap-3 p-3 bg-background rounded-lg border border-border cursor-grab active:cursor-grabbing hover:bg-muted/50 hover:shadow-md transition-all"
                      onDragStart={(e) => handleDragStart(e, tool)}
                      draggable
                    >
                      <div className="shrink-0 mt-0.5">
                        <Icon className={`w-5 h-5 ${tool.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          {tool.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tool.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
