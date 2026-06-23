'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CompradorImportDialog } from '@/components/assistants/CompradorImportDialog';
import type { CompradorResult } from '@/lib/assistants/comprador';

const brl = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const sevTone: Record<string, string> = {
  info: 'text-muted-foreground',
  warn: 'text-yellow-600 dark:text-yellow-500',
  danger: 'text-red-600 dark:text-red-500',
};

const EXEMPLO = {
  escopo: '200 paletes PBR (1200x1000), entrega no Porto de Santos, até 30 dias.',
  propostas:
    'Fornecedor A (Madeireira Litoral): R$ 95,00/un, frete R$ 1.200, impostos inclusos, prazo 20 dias, 28 ddl.\n' +
    'Fornecedor B (PaletPro): R$ 88,00/un, frete R$ 2.500, impostos +12%, prazo 35 dias, à vista.\n' +
    'Fornecedor C (EcoPallets): R$ 91,50/un, frete grátis, impostos inclusos, prazo 25 dias, 14 ddl.',
  politica: 'Alçada de aprovação automática: R$ 50.000. Exigir 3 cotações. Homologados: Madeireira Litoral, PaletPro.',
};

export function CompradorAssistant() {
  const [escopo, setEscopo] = useState('');
  const [propostas, setPropostas] = useState('');
  const [politica, setPolitica] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompradorResult | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  async function analisar() {
    if (!propostas.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/assistants/comprador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escopo, propostas, politica }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
        throw new Error(d.detail ?? d.error ?? `status ${res.status}`);
      }
      setResult((await res.json()) as CompradorResult);
    } catch (err) {
      toast.error('Falha ao analisar', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }

  const lbl = 'text-xs font-medium text-muted-foreground';

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Comparador de Cotações</h1>
        <p className="text-sm text-muted-foreground">
          Compara propostas por custo total (TCO), aponta desvios de política e gera o rascunho do PO — com revisão humana.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entrada */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Requisição & propostas</h2>
            <button
              onClick={() => { setEscopo(EXEMPLO.escopo); setPropostas(EXEMPLO.propostas); setPolitica(EXEMPLO.politica); }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Carregar exemplo
            </button>
          </div>
          <div className="space-y-1.5">
            <label className={lbl}>Escopo / requisição</label>
            <Input value={escopo} onChange={(e) => setEscopo(e.target.value)} placeholder="O que comprar, quantidade, prazo, local…" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={lbl}>Propostas dos fornecedores</label>
              <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Paperclip className="h-3.5 w-3.5 mr-1" /> Importar (PDF/Excel)
              </Button>
            </div>
            <Textarea value={propostas} onChange={(e) => setPropostas(e.target.value)} rows={9} placeholder="Cole as propostas recebidas (uma por bloco)…" />
          </div>
          <div className="space-y-1.5">
            <label className={lbl}>Política de compras / base homologada (opcional)</label>
            <Textarea value={politica} onChange={(e) => setPolitica(e.target.value)} rows={3} placeholder="Alçada, nº de cotações, fornecedores homologados…" />
          </div>
          <Button onClick={analisar} disabled={loading || !propostas.trim()} className="w-full">
            {loading ? 'Analisando…' : 'Comparar e recomendar'}
          </Button>
        </section>

        {/* Resultado */}
        <section className="space-y-4">
          {!result ? (
            <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
              O ranking, os desvios de política e o PO aparecem aqui.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-card p-5 space-y-2">
                <h2 className="text-sm font-semibold">Recomendação</h2>
                <div className="text-sm font-medium text-primary">{result.recomendacao_fornecedor}</div>
                <p className="text-sm text-muted-foreground">{result.justificativa}</p>
                <div className={'rounded-md border px-3 py-2 text-xs ' + (result.precisa_humano ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-green-500/40 bg-green-500/10')}>
                  {result.precisa_humano
                    ? `Requer aprovação humana — ${result.motivo_escalonamento}`
                    : 'Dentro da alçada do agente.'}
                  <span className={'ml-1 font-semibold ' + sevTone[result.severidade]}>[{result.severidade}]</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-2 border-b border-border text-xs font-medium text-muted-foreground">Ranking por TCO</div>
                <table className="w-full text-left text-xs">
                  <thead><tr className="text-muted-foreground border-b border-border"><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2 text-right">Custo total</th></tr></thead>
                  <tbody>
                    {result.ranking?.map((it, i) => (
                      <tr key={i} className={'border-b border-border/50 ' + (it.fornecedor === result.recomendacao_fornecedor ? 'bg-primary/10' : '')}>
                        <td className="px-3 py-2">{it.fornecedor}</td>
                        <td className="px-3 py-2">{it.prazo_entrega}</td>
                        <td className="px-3 py-2 text-right">{brl(it.custo_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.desvios_politica?.length ? (
                <div className="rounded-lg border border-red-500/40 bg-card p-5">
                  <div className="text-xs font-medium text-red-600 dark:text-red-500 mb-2">Desvios de política</div>
                  <ul className="space-y-1 text-sm">{result.desvios_politica.map((d, i) => <li key={i} className="text-red-600 dark:text-red-500">⛔ {d}</li>)}</ul>
                </div>
              ) : null}

              {result.pontos_negociacao?.length ? (
                <div className="rounded-lg border border-border bg-card p-5">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Pontos de negociação</div>
                  <ul className="space-y-1 text-sm text-muted-foreground">{result.pontos_negociacao.map((p, i) => <li key={i}>→ {p}</li>)}</ul>
                </div>
              ) : null}

              {result.pedido_compra?.fornecedor ? (
                <div className="rounded-lg border border-border bg-card p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground">Pedido de Compra (rascunho · revisão humana)</div>
                    <span className="text-xs font-mono text-primary">{result.pedido_compra.numero}</span>
                  </div>
                  <div className="text-sm"><span className="text-muted-foreground">Fornecedor:</span> {result.pedido_compra.fornecedor}</div>
                  <table className="w-full text-left text-xs">
                    <thead><tr className="text-muted-foreground border-b border-border"><th className="py-1">Item</th><th className="py-1">Qtd</th><th className="py-1 text-right">Total</th></tr></thead>
                    <tbody>{result.pedido_compra.itens?.map((it, i) => (<tr key={i} className="border-b border-border/40"><td className="py-1">{it.descricao}</td><td className="py-1">{it.quantidade}</td><td className="py-1 text-right">{brl(it.valor_total)}</td></tr>))}</tbody>
                  </table>
                  <div className="text-sm flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">{result.pedido_compra.condicao_pagamento} · {result.pedido_compra.prazo_entrega}</span>
                    <span className="font-semibold text-primary">{brl(result.pedido_compra.valor_total)}</span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <CompradorImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(t) => setPropostas((p) => (p ? p + '\n\n' : '') + t)}
      />
    </div>
  );
}
