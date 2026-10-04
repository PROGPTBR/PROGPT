'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Loader2, LogIn } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// "Entrar como o cliente" (sub-projeto 69). Gera um link de acesso de uso
// único para a conta do cliente — quem abre fica logado como ele e vê
// exatamente o que ele vê. O link é entregue para COPIAR e abrir numa janela
// anônima: abrir na mesma janela trocaria a sessão do próprio super admin
// pela do cliente (e o navegador não deixa um site abrir janela anônima).

const ERROS: Record<string, string> = {
  cannot_impersonate_self: 'Essa é a sua própria conta.',
  cannot_impersonate_super_admin: 'Não é possível entrar na conta de outro super admin.',
  user_inactive: 'O login desta conta está desativado. Reative o acesso antes.',
  user_not_found: 'Usuário não encontrado.',
};

export function ImpersonateDialog({
  userId,
  email,
  bloqueio,
}: {
  userId: string;
  email: string;
  /** Motivo para o botão vir desabilitado (super admin, login desativado). */
  bloqueio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function fechar() {
    setAberto(false);
    // O link é uma credencial de uso único — não fica guardado na tela.
    setLink(null);
    setCopiado(false);
  }

  async function gerar() {
    setGerando(true);
    try {
      const res = await fetch(`/api/plataforma/users/${userId}/impersonate`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error('Não foi possível gerar o acesso', {
          description: ERROS[data.error ?? ''] ?? 'Tente novamente em instantes.',
        });
        return;
      }
      setLink(data.url);
    } catch {
      toast.error('Não foi possível gerar o acesso', { description: 'Falha de conexão.' });
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      toast.error('Não foi possível copiar', { description: 'Selecione o link e copie manualmente.' });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={!!bloqueio}
        title={bloqueio}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-400"
      >
        <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Entrar como o cliente
      </button>

      <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Entrar como o cliente</DialogTitle>
            <DialogDescription>
              Você vai abrir a conta de <strong className="text-foreground">{email}</strong> exatamente como ele vê ao
              logar.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Você estará logado como o cliente e <strong className="text-foreground">pode agir como ele</strong>: mensagens, execuções e alterações ficam na conta dele.</li>
            <li>• Este acesso fica registrado na trilha de auditoria, e o &quot;último acesso&quot; do cliente passa a mostrar este login.</li>
            <li>• O link vale para um único acesso e expira em pouco tempo.</li>
          </ul>

          {!link ? (
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={fechar}
                className="h-9 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={gerar}
                disabled={gerando}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {gerando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Gerar acesso
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                Abra o link numa <strong>janela anônima</strong> (Ctrl+Shift+N). Na mesma janela, você sairia da sua
                conta de super admin.
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link}
                  aria-label="Link de acesso"
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-muted px-3 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={copiar}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  {copiado ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  {copiado ? 'Copiado' : 'Copiar link'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
