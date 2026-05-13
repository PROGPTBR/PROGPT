'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type TemplateDraft = {
  name: string;
  description: string;
  body_md: string;
};

type Props = {
  open: boolean;
  initial: TemplateDraft | null; // null = creating new
  onCancel: () => void;
  onSave: (draft: TemplateDraft) => void | Promise<void>;
};

const EMPTY: TemplateDraft = { name: '', description: '', body_md: '' };

export function TemplateEditor({ open, initial, onCancel, onSave }: Props) {
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Reset draft when modal opens with new initial value.
  useEffect(() => {
    if (open) setDraft(initial ?? EMPTY);
  }, [open, initial]);

  if (!open) return null;

  const valid = draft.name.trim().length >= 1 && draft.body_md.trim().length >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-card border border-border shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">
            {initial ? 'Editar template' : 'Novo template'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Markdown com placeholders (ex: <code>{`{{escopo}}`}</code>,{' '}
            <code>{`{{categoria}}`}</code>) que serão substituídos pelos parâmetros do
            usuário no momento da geração.
          </p>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Nome (obrigatório)
            </label>
            <Input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Ex: RFP padrão setor público (Lei 14.133)"
              maxLength={120}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Descrição (opcional)
            </label>
            <Input
              value={draft.description}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
              placeholder="1-2 frases que aparecem no picker do form"
              maxLength={500}
            />
          </div>
          <div className="flex-1 flex flex-col">
            <label className="text-xs text-muted-foreground block mb-1">
              Corpo do template (markdown, obrigatório)
            </label>
            <textarea
              value={draft.body_md}
              onChange={(e) => setDraft((d) => ({ ...d, body_md: e.target.value }))}
              className="font-mono text-xs rounded-md border border-input bg-background p-2 min-h-[400px] focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={`# Request for Proposal — {{categoria}}\n\n## 1. Escopo do trabalho\n\n{{escopo}}\n\n## 2. Critérios de avaliação\n\n...`}
              spellCheck={false}
            />
            <div className="text-[10px] text-muted-foreground text-right mt-1">
              {(draft.body_md.length / 1024).toFixed(1)} KB · {draft.body_md.length} chars
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={!valid || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  name: draft.name.trim(),
                  description: draft.description.trim(),
                  body_md: draft.body_md,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar template'}
          </Button>
        </div>
      </div>
    </div>
  );
}
