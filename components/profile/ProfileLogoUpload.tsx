'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Trash2, ImageOff } from 'lucide-react';

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
    <div className="rounded-2xl border border-white/5 bg-[#111111] p-6 space-y-4">
      <div className="flex items-start gap-5">
        <div className="h-24 w-24 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
          {loading ? (
            <span className="text-xs text-gray-500">…</span>
          ) : logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo da empresa"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center text-gray-500 gap-1">
              <ImageOff className="h-6 w-6" aria-hidden="true" />
              <span className="text-[10px]">Sem logo</span>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <label className="inline-flex items-center justify-center gap-1.5 text-sm cursor-pointer rounded-full bg-brand text-black px-5 h-10 hover:bg-brand/90 disabled:opacity-50 active:scale-95 transition-all duration-300 font-medium w-fit">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
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
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 text-gray-300 px-4 h-9 text-xs hover:bg-white/10 hover:text-white active:scale-95 transition-all duration-300 w-fit disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remover
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Formatos: PNG ou JPG. Tamanho ideal: 200×200 px ou superior, fundo
        transparente (PNG) para integração limpa nos documentos.
      </p>
    </div>
  );
}
