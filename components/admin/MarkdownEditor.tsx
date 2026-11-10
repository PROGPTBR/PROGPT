'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  showPreview?: boolean;
};

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeightClass = 'min-h-[400px]',
  showPreview = false,
}: Props) {
  return (
    <div className={showPreview ? 'grid gap-3 lg:grid-cols-2' : undefined}>
      <div className="flex flex-col">
        {showPreview && (
          <span className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Markdown
          </span>
        )}
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full flex-1 resize-y rounded-md border border-input bg-background p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring ${minHeightClass}`}
          placeholder={placeholder}
          spellCheck={false}
        />
        <div className="mt-1 text-right text-[10px] text-muted-foreground">
          {(value.length / 1024).toFixed(1)} KB · {value.length} caracteres
        </div>
      </div>

      {showPreview && (
        <div className="flex flex-col">
          <span className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Pré-visualização
          </span>
          <div className={`${minHeightClass} overflow-y-auto rounded-md border border-border bg-muted/20 p-4`}>
            {value ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">O conteúdo formatado aparecerá aqui.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
