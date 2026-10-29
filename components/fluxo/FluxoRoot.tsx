'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BarChart3, ListChecks, Loader2, MessageCircle, PenLine, Plus, Sparkles, Workflow } from 'lucide-react';
import { toast } from 'sonner';

import { FLUXO_STAGES, getStage } from '@/lib/fluxo/stages';
import type { FluxoProcesso } from '@/lib/fluxo/types';
import { RequisicaoGuiada } from './RequisicaoGuiada';
import { avisarSobDemanda } from '@/components/vitrine/ui';
import { solicitarProdutoHref } from '@/lib/vitrine/contato';

// Lista de processos + abertura de um novo. A entrada do fluxo é a
// requisição em texto, que a etapa 1 padroniza; ela pode ser escrita livre ou
// montada pelo modo guiado (pergunta a pergunta).
//
// Sob demanda (lib/fluxo/acesso.ts): sem `liberado`, a tela é vitrine: mostra
// o selo, o modo guiado e o processo de exemplo, e abrir um processo de
// verdade leva ao contato comercial.

function etapaLabel(processo: FluxoProcesso) {
  const stage = getStage(processo.etapa_atual);
  return stage ? `Etapa ${stage.num} · ${stage.label}` : processo.etapa_atual;
}

function concluidas(processo: FluxoProcesso) {
  return FLUXO_STAGES.filter((s) => !!processo.contexto?.[s.id]).length;
}

export function FluxoRoot({
  processosIniciais,
  liberado = true,
}: {
  processosIniciais: FluxoProcesso[];
  liberado?: boolean;
}) {
  const router = useRouter();

  const [processos] = useState(processosIniciais);
  const [abrindo, setAbrindo] = useState(processosIniciais.length === 0);
  const [titulo, setTitulo] = useState('');
  const [requisicao, setRequisicao] = useState('');
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [solicitanteEmail, setSolicitanteEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState<'guiado' | 'livre'>('guiado');
  const [guiadoPronto, setGuiadoPronto] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (requisicao.trim().length < 10) {
      toast.error('Descreva a necessidade da compra com um pouco mais de detalhe.');
      return;
    }

    if (!liberado) {
      avisarSobDemanda('fluxo_compras', 'Abrir um processo de verdade');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/fluxo/processos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, requisicao, solicitanteNome, solicitanteEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        processo?: FluxoProcesso;
        message?: string;
      };

      if (!res.ok || !data.processo) {
        toast.error(data.message ?? 'Não foi possível abrir o processo.');
        return;
      }

      router.push(`/fluxo/${data.processo.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-brand">
          <Workflow className="h-5 w-5" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Fluxo automatizado de compras
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Da solicitação à chegada do produto</h1>
          <span className="rounded-full bg-brand-gradient px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-black">
            Sob demanda
          </span>
        </div>

        <p className="text-sm text-muted-foreground max-w-2xl">
          Oito etapas encadeadas. A IA executa cada uma e para para você decidir:{' '}
          <strong className="text-foreground">SIGA</strong> avança,{' '}
          <strong className="text-foreground">AJUSTAR</strong> devolve a etapa para ser refeita.
          Nada anda sem a sua decisão.
        </p>
      </header>

      {/* Trilha das 8 etapas, só como mapa do processo */}
      {/* Quatro por linha: cada card fica largo o bastante para o nome da etapa
          caber sem partir palavra — e a quebra cai justo no corte do processo
          (linha 1 = S2C, etapas 1-4; linha 2 = P2P, etapas 5-8). */}
      <ol data-tour="fluxo-trilha" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FLUXO_STAGES.map((s) => (
          <li
            key={s.id}
            className={`min-w-0 rounded-xl border p-3 ${
              s.trilha === 's2c'
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-brand/30 bg-brand/5'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Etapa {s.num}
            </div>
            <div className="mt-1 text-xs font-medium leading-tight">{s.label}</div>
          </li>
        ))}
      </ol>

      <div data-tour="fluxo-acoes" className="flex flex-wrap items-center gap-2">
        <Link
          href="/fluxo/exemplo"
          className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/5 h-11 px-5 text-sm font-medium hover:bg-brand/10 transition-colors"
        >
          <Sparkles className="h-4 w-4 text-brand" aria-hidden />
          Carregar exemplo
        </Link>
        {!liberado && (
          <a
            href={solicitarProdutoHref('fluxo_compras')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground h-11 px-5 text-sm font-medium hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Quero na minha empresa
          </a>
        )}
        {!abrindo && (
          <button
            type="button"
            onClick={() => setAbrindo(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-11 px-5 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nova compra
          </button>
        )}

        {liberado && (
        <Link
          href="/fluxo/painel"
          className="inline-flex items-center gap-2 rounded-full border border-border h-11 px-5 text-sm font-medium hover:bg-accent transition-colors"
        >
          <BarChart3 className="h-4 w-4" aria-hidden />
          Gestão dos processos
        </Link>
        )}
      </div>

      {abrindo && (
        <form
          onSubmit={criar}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Abrir um processo de compra</h2>
            <div className="inline-flex rounded-full border border-border p-0.5 text-xs" role="tablist" aria-label="Como descrever a compra">
              <button
                type="button"
                role="tab"
                aria-selected={modo === 'guiado'}
                onClick={() => setModo('guiado')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 ${modo === 'guiado' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <ListChecks className="h-3.5 w-3.5" aria-hidden /> Passo a passo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modo === 'livre'}
                onClick={() => setModo('livre')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 ${modo === 'livre' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden /> Escrever livre
              </button>
            </div>
          </div>

          {modo === 'guiado' && (
            <RequisicaoGuiada
              onPronto={(r) => {
                setTitulo(r.titulo);
                setRequisicao(r.requisicao);
                setGuiadoPronto(true);
              }}
              onRefazer={() => setGuiadoPronto(false)}
            />
          )}

          {(modo === 'livre' || guiadoPronto) && (
          <>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="titulo">
              Título (opcional)
            </label>
            <input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Compra de notebooks, TI"
              className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="req">
              Qual é a necessidade?
            </label>
            <textarea
              id="req"
              value={requisicao}
              onChange={(e) => setRequisicao(e.target.value)}
              rows={6}
              placeholder="Descreva o item ou serviço, quantidade, prazo desejado, centro de custo, orçamento e a justificativa. Pode colar o e-mail da área solicitante."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <fieldset className="rounded-xl border border-border bg-muted/20 p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Quem pediu a compra? (opcional)
            </legend>
            <p className="mb-2 text-xs text-muted-foreground">
              Essa pessoa recebe por e-mail um link para acompanhar o pedido e um aviso a cada etapa
              concluída, sem precisar de conta no PROGPT.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                aria-label="Nome de quem pediu"
                value={solicitanteNome}
                onChange={(e) => setSolicitanteNome(e.target.value)}
                placeholder="Nome"
                className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <input
                aria-label="E-mail de quem pediu"
                type="email"
                value={solicitanteEmail}
                onChange={(e) => setSolicitanteEmail(e.target.value)}
                placeholder="email@empresa.com.br"
                className="w-full rounded-lg border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </fieldset>

          </>
          )}

          {(modo === 'livre' || guiadoPronto) && (
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-10 px-5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Abrir processo
            </button>

            {processos.length > 0 && (
              <button
                type="button"
                onClick={() => setAbrindo(false)}
                className="rounded-full border border-border h-10 px-5 text-sm text-muted-foreground hover:bg-accent"
              >
                Cancelar
              </button>
            )}
          </div>
          )}
        </form>
      )}

      {processos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Seus processos</h2>

          <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
            {processos.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/fluxo/${p.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.status === 'concluido' ? 'Concluído' : etapaLabel(p)} ·{' '}
                      {concluidas(p)} de {FLUXO_STAGES.length} etapas aprovadas
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
