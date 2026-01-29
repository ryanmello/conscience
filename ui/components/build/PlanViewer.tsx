import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function PlanViewer({ content }: { content: string }) {
  return (
    <div className="h-full overflow-auto p-5 scrollbar-textarea bg-card">
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Headings
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold text-foreground mt-4 mb-2">
                {children}
              </h3>
            ),
            // Paragraphs
            p: ({ children }) => (
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                {children}
              </p>
            ),
            // Lists
            ul: ({ children }) => (
              <ul className="list-disc list-outside ml-5 mb-4 space-y-1.5">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-outside ml-5 mb-4 space-y-1.5">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-muted-foreground leading-relaxed">
                {children}
              </li>
            ),
            // Inline code
            code: ({ className, children }) => {
              const isCodeBlock = className?.includes('language-');
              if (isCodeBlock) {
                return (
                  <code className="block bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
                    {children}
                  </code>
                );
              }
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
                  {children}
                </code>
              );
            },
            // Code blocks
            pre: ({ children }) => (
              <pre className="bg-muted rounded-md mb-4 overflow-x-auto">
                {children}
              </pre>
            ),
            // Strong/Bold
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            // Emphasis/Italic
            em: ({ children }) => (
              <em className="italic">{children}</em>
            ),
            // Blockquotes
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-border pl-4 my-4 italic text-muted-foreground">
                {children}
              </blockquote>
            ),
            // Horizontal rule
            hr: () => <hr className="border-border my-6" />,
            // Links
            a: ({ href, children }) => (
              <a 
                href={href} 
                className="text-blue-500 hover:text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            // Tables
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border border-border rounded-md">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-muted">{children}</thead>
            ),
            th: ({ children }) => (
              <th className="px-3 py-2 text-left text-xs font-semibold text-foreground border-b border-border">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 text-sm text-muted-foreground border-b border-border">
                {children}
              </td>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
