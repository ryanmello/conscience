export default function PlanViewer({ content }: { content: string }) {
  return (
    <div className="h-full overflow-auto p-5 scrollbar-textarea bg-card">
      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono text-muted-foreground">
        {content}
      </pre>
    </div>
  );
}
