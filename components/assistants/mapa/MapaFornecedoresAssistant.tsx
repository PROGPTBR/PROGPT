'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, MapPinned } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EventoMapa, FornecedorMapa, Plano } from '@/lib/mapa-fornecedores/tipos';
import { MapaResultado } from './MapaResultado';

// Mapa de Fornecedores da Operação: o comprador descreve a empresa e a região,
// a IA monta as categorias de compra, busca fornecedores reais na internet
// para cada uma e mostra tudo num mapa, com relatório de quem acionar primeiro
// e onde pedir mais cotações. A rota responde em NDJSON e a tela vai se
// enchendo conforme as buscas terminam.

const EXEMPLO = `Sou do time de suprimentos do GRPCOM (Grupo Paranaense de Comunicação), maior grupo de mídia do Paraná, com sede em Curitiba: RPC (TV afiliada da Globo, 8 emissoras regionais), Gazeta do Povo (jornal e portal), Tribuna do Paraná, rádios 98FM e Mundo Livre FM e o Instituto GRPCOM.
Quero os 50 fornecedores da região de Curitiba que podem atender a nossa operação, em CAPEX e OPEX: quem acionar primeiro e onde pedir mais cotações.`;

type Fase = 'pedido' | 'plano' | 'buscando' | 'localizando' | 'escrevendo' | 'pronto';

const ETAPAS: { fase: Fase; rotulo: string }[] = [
  { fase: 'plano', rotulo: 'Entendendo a operação e as categorias de compra' },
  { fase: 'buscando', rotulo: 'Buscando fornecedores na internet, categoria por categoria' },
  { fase: 'localizando', rotulo: 'Localizando os endereços no mapa' },
  { fase: 'escrevendo', rotulo: 'Escrevendo quem acionar primeiro e onde cotar mais' },
];
const ORDEM: Fase[] = ['pedido', 'plano', 'buscando', 'localizando', 'escrevendo', 'pronto'];

export function MapaFornecedoresAssistant({ pedidoInicial = '' }: { pedidoInicial?: string }) {
  const [pedido, setPedido] = useState(pedidoInicial);
  const [fase, setFase] = useState<Fase>('pedido');
  const [plano, setPlano] = useState<Plano | null>(null);
  const [fornecedores, setFornecedores] = useState<FornecedorMapa[]>([]);
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());
  const [relatorio, setRelatorio] = useState('');
  const [runId, setRunId] = useState<string | null>(null);

  const rodando = fase !== 'pedido' && fase !== 'pronto';

  // Todas as categorias voltaram: o servidor passa a localizar os endereços.
  useEffect(() => {
    if (fase === 'buscando' && plano && pendentes.size === 0) setFase('localizando');
  }, [fase, plano, pendentes]);

  function tratar(e: EventoMapa) {
    switch (e.tipo) {
      case 'inicio':
        setRunId(e.runId);
        break;
      case 'plano':
        setPlano(e.plano);
        setPendentes(new Set(e.plano.categorias.map((c) => c.nome)));
        setFase('buscando');
        break;
      case 'categoria':
        setFornecedores((prev) => [...prev, ...e.fornecedores]);
        setPendentes((prev) => {
          const n = new Set(prev);
          n.delete(e.categoria);
          return n;
        });
        break;
      case 'pontos':
        setFornecedores(e.fornecedores);
        setPendentes(new Set());
        setFase('escrevendo');
        break;
      case 'texto':
        setRelatorio((prev) => prev + e.delta);
        break;
      case 'fim':
        setFase('pronto');
        break;
      case 'erro':
        toast.error(e.mensagem);
        setFase((f) => (f === 'plano' ? 'pedido' : 'pronto'));
        break;
    }
  }

  async function mapear() {
    if (pedido.trim().length < 15) {
      toast.error('Descreva a empresa, o setor e a região.');
      return;
    }
    setFase('plano');
    setPlano(null);
    setFornecedores([]);
    setRelatorio('');
    setRunId(null);
    try {
      const res = await fetch('/api/assistants/mapa_fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido }),
      });
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
        throw new Error(d.detail ?? d.error ?? `status ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const linhas = buffer.split('\n');
        buffer = linhas.pop() ?? '';
        for (const l of linhas) {
          if (!l.trim()) continue;
          try {
            tratar(JSON.parse(l) as EventoMapa);
          } catch {
            // linha incompleta
          }
        }
      }
      setFase((f) => (f === 'pedido' ? f : 'pronto'));
    } catch (err) {
      toast.error('Não foi possível mapear agora', { description: err instanceof Error ? err.message : String(err) });
      setFase('pedido');
    }
  }

  const idx = ORDEM.indexOf(fase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Mapa de Fornecedores da Operação <span className="text-brand">.</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Descreva a empresa e a região. O PROGPT monta as categorias de compra (CAPEX e OPEX), procura fornecedores
          reais na internet para cada uma, mostra todos num mapa e diz quem acionar primeiro e onde pedir mais
          cotações.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <textarea
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          rows={6}
          disabled={rodando}
          placeholder="Ex.: Somos uma rede de hospitais em Belo Horizonte. Quero 40 fornecedores da região para manutenção, equipamentos, TI, alimentação e limpeza..."
          className="w-full rounded-xl border border-input bg-background p-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={mapear} disabled={rodando}>
            {rodando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MapPinned className="mr-1 h-4 w-4" />}
            {rodando ? 'Mapeando…' : 'Mapear fornecedores'}
          </Button>
          <Button variant="outline" onClick={() => setPedido(EXEMPLO)} disabled={rodando}>
            Carregar exemplo
          </Button>
          <span className="text-xs text-muted-foreground">Leva de 1 a 3 minutos. O resultado fica salvo no Histórico.</span>
        </div>

        {fase !== 'pedido' && (
          <ol className="space-y-1.5 pt-2 text-sm">
            {ETAPAS.map((e) => {
              const i = ORDEM.indexOf(e.fase);
              const feito = idx > i;
              const atual = idx === i;
              return (
                <li key={e.fase} className={`flex items-center gap-2 ${feito || atual ? '' : 'text-muted-foreground'}`}>
                  {feito ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : atual ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <span className="inline-block h-4 w-4 rounded-full border" />
                  )}
                  {e.rotulo}
                  {e.fase === 'buscando' && atual && plano && (
                    <span className="text-xs text-muted-foreground">
                      ({plano.categorias.length - pendentes.size} de {plano.categorias.length} categorias, {fornecedores.length} encontrados)
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {fase !== 'pedido' && (
        <MapaResultado
          plano={plano}
          fornecedores={fornecedores}
          relatorio={relatorio}
          runId={fase === 'pronto' ? runId : null}
          pendentes={pendentes}
          localizando={fase === 'buscando' || fase === 'localizando'}
          escrevendo={fase === 'escrevendo'}
        />
      )}

      {fase === 'pronto' && (
        <p className="text-xs text-muted-foreground">
          A lista vem de busca na internet: confirme cada fornecedor na homologação antes de cotar. Mapa ©
          OpenStreetMap.
        </p>
      )}
    </div>
  );
}
