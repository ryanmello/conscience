export default function CodeViewer({ code }: { code: string }) {
  return (
    <div className="h-full overflow-auto bg-[#1e1e1e] p-5 scrollbar-textarea">
      <pre className="text-sm leading-relaxed font-mono">
        <code className="text-[#d4d4d4]">{code}</code>
      </pre>
    </div>
  );
}
