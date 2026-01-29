'use client';

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PanelLeftClose, PanelLeftOpen, FileText, Code } from "lucide-react";
import PlanViewer from "@/components/build/PlanViewer";
import CodeViewer from "@/components/build/CodeViewer";
import type { FileSystemNode } from "@/types/file-system";

type Tab = 'plan' | 'code';

interface TabBarProps {
  planContent: string;
  files: FileSystemNode[];
  onFileChange?: (path: string, content: string) => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'plan', label: 'Plan', icon: <FileText size={14} /> },
  { id: 'code', label: 'Code', icon: <Code size={14} /> },
];

export default function TabBar({ 
  planContent, 
  files, 
  onFileChange,
  onCollapseChange 
}: TabBarProps) {
  const [activeTab, setActiveTab] = useState<Tab>('plan');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 min-h-10">
        <div className="flex">
          {!isCollapsed && tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "cursor-pointer flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-blue-500 text-foreground bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleToggleCollapse}
          className="cursor-pointer flex items-center justify-center p-2 mr-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Tab Content */}
      {!isCollapsed && (
        <div className="flex-1 min-h-0">
          {activeTab === 'plan' ? (
            <PlanViewer content={planContent} />
          ) : (
            <CodeViewer files={files} onFileChange={onFileChange} />
          )}
        </div>
      )}
    </div>
  );
}
