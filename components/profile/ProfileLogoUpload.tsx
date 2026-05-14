'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Trash2, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Sub-projeto 22 — Logo upload UI.
//
// Backend ownership: cookie auth → /api/profile/logo. We never persist
// the chosen file client-side; on mount we ask the backend for the
// current logo bytes (GET → 200 image | 404).

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg'];

export function ProfileLogoUpload() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile/logo', { cache: 'no-store' });
      if (res.status === 404) {
        setLogoUrl(null);
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      setLogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      toast.error('Falha ao carregar logo', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      // Component-level cleanup — also handled inside refresh, but
      // protects against unmount-while-fetching.
      setLogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Formato inválido', { description: 'Use PNG ou JPG' });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Arquivo grande demais', { description: 'Limite de 2 MB' });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/profile/logo', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }
      toast.success('Logo atualizado');
      await refresh();
    } catch (err) {
      toast.error('Falha ao enviar', { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      const res = await fetch('/api/profile/logo', { method: 'DELETE' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success('Logo removido');
      setLogoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (err) {
      toast.error('Falha ao remover', { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 rounded-md border border-border bg-background flex items-center justify-center overflow-hidden">
          {loading ? (
            <span className="text-xs text-muted-foreground">…</span>
          ) : logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground gap-1">
              <ImageOff className="h-6 w-6" />
              <span className="text-[10px]">Sem logo</span>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <label className="inline-flex items-center justify-center gap-1.5 text-sm cursor-pointer rounded-md border border-input bg-background px-3 h-9 hover:bg-accent disabled:opacity-50 w-fit">
            <Upload className="h-3.5 w-3.5" />
            {busy ? 'Enviando…' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
          </label>
          {logoUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={busy}
              className="w-fit"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remover
            </Button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Formatos: PNG ou JPG. Tamanho ideal: 200×200 px ou superior, fundo transparente
        (PNG) para integração limpa nos documentos.
      </p>
    </div>
  );
}
