'use client';

import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

// Botões do gestor na página pública de aprovação (sub-projeto 90).
// Reprovar exige motivo: é o que o comprador usa para corrigir a etapa.
export function DecisaoGestor({ token }: { token: string }) {
  const [reprovando, setReprovando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [busy, setBusy] = useState<null | 'aprovar' | 'reprovar'>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<null | 'aprovar' | 'reprovar'>(null);

  async function decidir(decisao: 'aprovar' | 'reprovar') {
    if (busy) return;
    if (decisao === 'reprovar' && !comentario.trim()) {
      setErro('Diga o motivo da reprovação, para o comprador saber o que corrigir.');
      return;
    }
    setErro(null);
    setBusy(decisao);
    try {
      const res = await fetch(`/api/fluxo/aprovar/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, comentario }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setErro(data.message ?? 'Não foi possível registrar agora. Tente de novo.');
        return;
      }
      setFeito(decisao);
    } catch {
      setErro('Sem conexão. Tente de novo.');
    } finally {
      setBusy(null);
    }
  }

  if (feito) {
    return (
      <div
        role="status"
        className={`rounded-2xl border p-5 text-center ${
          feito === 'aprovar' ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-orange-500/40 bg-orange-500/10'
        }`}
      >
        <div className="text-base font-semibold">{feito === 'aprovar' ? 'Aprovado. Obrigado!' : 'Reprovação registrada.'}</div>
        <p className="mt-1 text-sm text-muted-foreground">
          {feito === 'aprovar'
            ? 'A compra seguiu para a próxima etapa e o comprador foi avisado por e-mail.'
            : 'A etapa voltou para o comprador com o seu motivo.'}
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-brand bg-card p-5 space-y-3">
      <label htmlFor="comentario" className="block text-sm font-medium">
        {reprovando ? 'Motivo da reprovação' : 'Comentário (opcional)'}
      </label>
      <textarea
        id="comentario"
        rows={3}
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder={reprovando ? 'O que precisa mudar?' : 'Algo que o comprador deva saber'}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decidir('aprovar')}
          disabled={busy !== null || reprovando}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white h-11 px-6 text-sm font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {busy === 'aprovar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
          Aprovar
        </button>
        <button
          type="button"
          onClick={() => (reprovando ? decidir('reprovar') : setReprovando(true))}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 text-white h-11 px-6 text-sm font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {busy === 'reprovar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
          {reprovando ? 'Confirmar reprovação' : 'Reprovar'}
        </button>
        {reprovando && (
          <button
            type="button"
            onClick={() => setReprovando(false)}
            className="rounded-full border border-border h-11 px-5 text-sm text-muted-foreground hover:bg-accent"
          >
            Voltar
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">A decisão fica registrada com o seu nome e e-mail.</p>
    </section>
  );
}
