'use client';

import { useMemo, useState } from 'react';
import { Check, FileText, Plus, Search, Paperclip, Clock, FileSpreadsheet, Printer } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Abas,
  AvisoDemonstracao,
  BarraProgresso,
  Kpi,
  ListaBarras,
  Secao,
  Selo,
  VitrineCabecalho,
  avisarSobDemanda,
  useAbaDoTour,
  type TomSelo,
} from '@/components/vitrine/ui';
import { dataDeIso, formatarData } from '@/lib/vitrine/datas';
import {
  CICLO_DE_VIDA,
  EVENTO_LABEL,
  FLUXO_COLUNAS,
  SETORES,
  STATUS_LABEL,
  STATUS_ORDER,
  calcularIndicadores,
  calcularPrazo,
  colunaDoFluxo,
  contarPorStatus,
  contarPorSetor,
  etapaDoCiclo,
  montarDemandasExemplo,
  pessoaPorId,
  setorPorSlug,
  type PrazoTom,
  type Sp,
  type SpStatus,
} from '@/lib/vitrine/demandas';

const PRODUTO = 'gestao_demandas' as const;

type AbaId = 'visao' | 'setores' | 'fluxo' | 'relatorios';

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'visao', label: 'Visão Geral' },
  { id: 'setores', label: 'Setores' },
  { id: 'fluxo', label: 'Quadro de fluxo' },
  { id: 'relatorios', label: 'Relatórios' },
];
const IDS_ABAS = ABAS.map((a) => a.id);

const TOM_STATUS: Record<SpStatus, TomSelo> = {
  aberta: 'cinza',
  em_andamento: 'azul',
  aguardando_resposta: 'amarelo',
  aguardando_validacao: 'roxo',
  concluida: 'verde',
  cancelada: 'neutro',
};


const TOM_PRAZO: Record<PrazoTom, TomSelo> = {
  verde: 'verde',
  amarelo: 'amarelo',
  vermelho: 'vermelho',
  neutro: 'cinza',
};

const nomeDe = (id: string | undefined) => (id ? (pessoaPorId(id)?.nome ?? id) : '—');
const nomesDe = (ids: string[]) => ids.map(nomeDe).join(', ');

export function GestaoDemandasDemo({ hojeIso }: { hojeIso: string }) {
  const sps = useMemo(() => montarDemandasExemplo(dataDeIso(hojeIso)), [hojeIso]);
  const [aba, setAba] = useState<AbaId>('visao');
  useAbaDoTour(IDS_ABAS, setAba);
  const [aberta, setAberta] = useState<Sp | null>(null);

  return (
    <>
      <VitrineCabecalho
        produto={PRODUTO}
        titulo="Gestão de Demandas"
        descricao="Solicitações de Providência entre setores: quem pediu, quem responde, prazo, percentual de conclusão, histórico e validação da entrega — tudo rastreável em um só lugar."
      />
      <AvisoDemonstracao produto={PRODUTO} />
      <Abas abas={ABAS} ativa={aba} onChange={setAba} />

      {aba === 'visao' && <VisaoGeral sps={sps} hojeIso={hojeIso} onAbrir={setAberta} />}
      {aba === 'setores' && <PainelSetores sps={sps} hojeIso={hojeIso} onAbrir={setAberta} />}
      {aba === 'fluxo' && <QuadroFluxo sps={sps} hojeIso={hojeIso} onAbrir={setAberta} />}
      {aba === 'relatorios' && <Relatorios sps={sps} hojeIso={hojeIso} onAbrir={setAberta} />}

      <DetalheSp sp={aberta} hojeIso={hojeIso} onFechar={() => setAberta(null)} />
    </>
  );
}

type VisaoProps = { sps: Sp[]; hojeIso: string; onAbrir: (sp: Sp) => void };

// ─── Visão Geral ──────────────────────────────────────────────────────────

function VisaoGeral({ sps, hojeIso, onAbrir }: VisaoProps) {
  const ind = calcularIndicadores(sps, hojeIso);
  const porStatus = contarPorStatus(sps);
  const porSetor = contarPorSetor(sps, SETORES, hojeIso);
  const atrasadas = sps
    .filter((s) => calcularPrazo(s, hojeIso).atrasada)
    .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista));

  return (
    <div className="space-y-4">
      <div data-tour="demandas-kpis" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total de SPs" valor={String(ind.total)} />
        <Kpi label="Abertas" valor={String(ind.abertas)} />
        <Kpi label="Em andamento" valor={String(ind.emAndamento)} />
        <Kpi label="Aguardando validação" valor={String(ind.aguardandoValidacao)} />
        <Kpi label="Concluídas" valor={String(ind.concluidas)} tom="positivo" />
        <Kpi label="Em atraso" valor={String(ind.emAtraso)} tom={ind.emAtraso ? 'alerta' : 'padrao'} />
        <Kpi
          label="Conclusão no prazo"
          valor={ind.conclusaoNoPrazo === null ? '—' : `${ind.conclusaoNoPrazo}%`}
          detalhe="das SPs concluídas"
        />
        <Kpi
          label="Tempo médio"
          valor={ind.tempoMedioDias === null ? '—' : `${ind.tempoMedioDias.toLocaleString('pt-BR')} dias`}
          detalhe="da emissão à conclusão"
        />
      </div>

      {/* Barras neutras nos dois quadros: com cores, os status e os setores
          pareciam a mesma legenda (pedido do diretor 2026-10-04). */}
      <div data-tour="demandas-graficos" className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Distribuição por status">
          <ListaBarras neutro linhas={porStatus.map((p) => ({ label: STATUS_LABEL[p.status], valor: p.total }))} />
        </Secao>
        <Secao titulo="SPs por setor">
          <ListaBarras
            neutro
            linhas={porSetor.map((p) => ({
              label: p.setor.nome,
              valor: p.total,
              detalhe: p.atrasadas ? `· ${p.atrasadas} em atraso` : undefined,
            }))}
          />
        </Secao>
      </div>

      <Secao data-tour="demandas-atraso" titulo={`Em atraso (${atrasadas.length})`}>
        {atrasadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma SP em atraso.</p>
        ) : (
          <TabelaSps sps={atrasadas} hojeIso={hojeIso} onAbrir={onAbrir} />
        )}
      </Secao>
    </div>
  );
}

// ─── Painel dos setores ───────────────────────────────────────────────────

function PainelSetores({ sps, hojeIso, onAbrir }: VisaoProps) {
  const [setor, setSetor] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<SpStatus | 'todos'>('todos');

  const visiveis = sps.filter((s) => {
    if (setor !== 'todos' && s.setor !== setor) return false;
    if (status !== 'todos' && s.status !== status) return false;
    const q = busca.trim().toLowerCase();
    if (q && !`${s.codigo} ${s.tema} ${nomesDe(s.responsaveis)}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const opcoesSetor = [{ slug: 'todos', nome: 'Todos os setores' }, ...SETORES];

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav data-tour="demandas-setores" aria-label="Setores" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {opcoesSetor.map((s) => {
          const total = s.slug === 'todos' ? sps.length : sps.filter((sp) => sp.setor === s.slug).length;
          const ativo = s.slug === setor;
          const cor = 'cor' in s ? s.cor : undefined;
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSetor(s.slug)}
              aria-pressed={ativo}
              className={
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ' +
                (ativo ? 'bg-brand-gradient-soft font-medium text-brand' : 'text-foreground/80 hover:bg-accent')
              }
            >
              {cor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden="true" />}
              <span className="flex-1 truncate">{s.nome}</span>
              <span className="tabular-nums text-xs text-muted-foreground">{total}</span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Buscar SP</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, tema ou responsável"
              className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
          </label>
          <select
            aria-label="Filtrar por status"
            value={status}
            onChange={(e) => setStatus(e.target.value as SpStatus | 'todos')}
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="todos">Todos os status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => avisarSobDemanda(PRODUTO, 'Abrir nova SP')}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova SP
          </button>
        </div>

        {visiveis.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma SP com esses filtros.
          </p>
        ) : (
          <div data-tour="demandas-cartoes" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visiveis.map((sp) => (
              <CartaoSp key={sp.id} sp={sp} hojeIso={hojeIso} onAbrir={onAbrir} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CartaoSp({ sp, hojeIso, onAbrir }: { sp: Sp; hojeIso: string; onAbrir: (sp: Sp) => void }) {
  const prazo = calcularPrazo(sp, hojeIso);
  const setor = setorPorSlug(sp.setor);
  const etapa = etapaDoCiclo(sp.status);

  return (
    <button
      type="button"
      onClick={() => onAbrir(sp)}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{sp.codigo}</span>
        <Selo tom={TOM_STATUS[sp.status]}>{STATUS_LABEL[sp.status]}</Selo>
      </div>
      <div>
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{sp.tema}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {setor && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: setor.cor }} aria-hidden="true" />}
          {setor?.nome} · {nomesDe(sp.responsaveis)}
        </p>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Conclusão</span>
          <span className="tabular-nums">{sp.percentual}%</span>
        </div>
        <BarraProgresso pct={sp.percentual} />
      </div>
      {etapa >= 0 && (
        <ol className="flex gap-1" aria-label="Ciclo de vida">
          {CICLO_DE_VIDA.map((rotulo, i) => (
            <li
              key={rotulo}
              title={rotulo}
              className={`h-1 flex-1 rounded-full ${i <= etapa ? 'bg-brand' : 'bg-muted'}`}
            />
          ))}
        </ol>
      )}
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {formatarData(sp.dataEmissao)} → {formatarData(sp.dataPrevista)}
        </span>
        <Selo tom={TOM_PRAZO[prazo.tom]}>{prazo.label}</Selo>
      </div>
    </button>
  );
}

// ─── Quadro de fluxo ──────────────────────────────────────────────────────

function QuadroFluxo({ sps, hojeIso, onAbrir }: VisaoProps) {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Ninguém arrasta cartão: cada SP muda de coluna sozinha quando o setor confirma o recebimento, quando o
        responsável começa a trabalhar e quando a entrega vai para validação.
      </p>
      <div data-tour="demandas-fluxo" className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {FLUXO_COLUNAS.map((col) => {
          const doFluxo = sps.filter((s) => colunaDoFluxo(s) === col.id);
          return (
            <div key={col.id} className="flex min-w-0 flex-col rounded-xl bg-muted/60 p-2">
              <div className="px-1.5 pb-2 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{col.label}</h3>
                  <span className="text-xs tabular-nums text-muted-foreground">{doFluxo.length}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{col.comoEntra}</p>
              </div>
              <div className="flex flex-col gap-2">
                {doFluxo.map((sp) => {
                  const prazo = calcularPrazo(sp, hojeIso);
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => onAbrir(sp)}
                      className="rounded-lg border border-border bg-card p-2.5 text-left text-xs transition-shadow hover:shadow-md"
                    >
                      <div className="font-mono text-[10px] text-muted-foreground">{sp.codigo}</div>
                      <div className="mt-0.5 line-clamp-2 font-medium">{sp.tema}</div>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="truncate text-muted-foreground">{nomeDe(sp.responsaveis[0])}</span>
                        <Selo tom={TOM_PRAZO[prazo.tom]}>{prazo.label}</Selo>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Relatórios ───────────────────────────────────────────────────────────

type FiltroPrazo = 'todas' | 'no_prazo' | 'atencao' | 'atrasadas' | 'encerradas';

function Relatorios({ sps, hojeIso, onAbrir }: VisaoProps) {
  const [setor, setSetor] = useState('todos');
  const [status, setStatus] = useState<SpStatus | 'todos'>('todos');
  const [prazo, setPrazo] = useState<FiltroPrazo>('todas');

  const linhas = sps.filter((s) => {
    if (setor !== 'todos' && s.setor !== setor) return false;
    if (status !== 'todos' && s.status !== status) return false;
    const p = calcularPrazo(s, hojeIso);
    if (prazo === 'no_prazo' && !(p.tom === 'verde' && s.status !== 'concluida')) return false;
    if (prazo === 'atencao' && p.tom !== 'amarelo') return false;
    if (prazo === 'atrasadas' && !p.atrasada) return false;
    if (prazo === 'encerradas' && s.status !== 'concluida' && s.status !== 'cancelada') return false;
    return true;
  });

  const seletor = 'h-9 rounded-lg border border-input bg-card px-3 text-sm';

  return (
    <Secao data-tour="demandas-relatorios"
      titulo={`Relatório de SPs (${linhas.length})`}
      acoes={
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => avisarSobDemanda(PRODUTO, 'Exportar para Excel')}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-accent"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => avisarSobDemanda(PRODUTO, 'Exportar para PDF')}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-accent"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            PDF
          </button>
        </div>
      }
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <select aria-label="Setor" value={setor} onChange={(e) => setSetor(e.target.value)} className={seletor}>
          <option value="todos">Todos os setores</option>
          {SETORES.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as SpStatus | 'todos')}
          className={seletor}
        >
          <option value="todos">Todos os status</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Situação do prazo"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value as FiltroPrazo)}
          className={seletor}
        >
          <option value="todas">Qualquer situação de prazo</option>
          <option value="no_prazo">No prazo</option>
          <option value="atencao">Atenção (vence em breve)</option>
          <option value="atrasadas">Em atraso</option>
          <option value="encerradas">Concluídas ou canceladas</option>
        </select>
      </div>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma SP com esses filtros.</p>
      ) : (
        <TabelaSps sps={linhas} hojeIso={hojeIso} onAbrir={onAbrir} />
      )}
    </Secao>
  );
}

function TabelaSps({ sps, hojeIso, onAbrir }: VisaoProps) {
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium sm:px-5">Código</th>
            <th className="px-2 py-2 font-medium">Tema</th>
            <th className="px-2 py-2 font-medium">Setor</th>
            <th className="px-2 py-2 font-medium">Responsável</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-2 py-2 text-right font-medium">%</th>
            <th className="px-4 py-2 font-medium sm:px-5">Prazo</th>
          </tr>
        </thead>
        <tbody>
          {sps.map((sp) => {
            const prazo = calcularPrazo(sp, hojeIso);
            return (
              <tr
                key={sp.id}
                onClick={() => onAbrir(sp)}
                className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-accent/50"
              >
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs sm:px-5">
                  {/* Botão real para teclado/leitor de tela; a linha inteira é atalho de mouse. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAbrir(sp);
                    }}
                    className="hover:underline"
                  >
                    {sp.codigo}
                  </button>
                </td>
                <td className="max-w-[280px] truncate px-2 py-2.5">{sp.tema}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground">{setorPorSlug(sp.setor)?.nome}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground">{nomeDe(sp.responsaveis[0])}</td>
                <td className="px-2 py-2.5">
                  <Selo tom={TOM_STATUS[sp.status]}>{STATUS_LABEL[sp.status]}</Selo>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{sp.percentual}%</td>
                <td className="px-4 py-2.5 sm:px-5">
                  <Selo tom={TOM_PRAZO[prazo.tom]}>{prazo.label}</Selo>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detalhe da SP ────────────────────────────────────────────────────────

function DetalheSp({ sp, hojeIso, onFechar }: { sp: Sp | null; hojeIso: string; onFechar: () => void }) {
  return (
    <Dialog open={!!sp} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {sp && <ConteudoDetalhe sp={sp} hojeIso={hojeIso} />}
      </DialogContent>
    </Dialog>
  );
}

function ConteudoDetalhe({ sp, hojeIso }: { sp: Sp; hojeIso: string }) {
  const prazo = calcularPrazo(sp, hojeIso);
  const etapa = etapaDoCiclo(sp.status);
  const encerrada = sp.status === 'concluida' || sp.status === 'cancelada';

  const acoes: string[] = encerrada
    ? []
    : sp.status === 'aguardando_validacao'
      ? ['Validar entrega', 'Devolver para ajustes']
      : ['Registrar resposta', 'Atualizar percentual', 'Solicitar prorrogação'];

  return (
    <div className="space-y-5">
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <span className="font-mono text-xs text-muted-foreground">{sp.codigo}</span>
          <Selo tom={TOM_STATUS[sp.status]}>{STATUS_LABEL[sp.status]}</Selo>
          <Selo tom={TOM_PRAZO[prazo.tom]}>{prazo.label}</Selo>
        </div>
        <DialogTitle className="text-lg">{sp.tema}</DialogTitle>
        <DialogDescription>{setorPorSlug(sp.setor)?.nome}</DialogDescription>
      </DialogHeader>

      {etapa >= 0 && (
        <ol className="grid grid-cols-4 gap-2" aria-label="Ciclo de vida">
          {CICLO_DE_VIDA.map((rotulo, i) => (
            <li key={rotulo} className="text-center">
              <div className={`h-1.5 rounded-full ${i <= etapa ? 'bg-brand' : 'bg-muted'}`} />
              <span className={`mt-1 block text-[11px] ${i === etapa ? 'font-medium text-brand' : 'text-muted-foreground'}`}>
                {rotulo}
              </span>
            </li>
          ))}
        </ol>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <Campo rotulo="Solicitante" valor={nomeDe(sp.solicitante)} />
        <Campo rotulo="Emissor" valor={nomeDe(sp.emissor)} />
        <Campo rotulo={sp.responsaveis.length > 1 ? 'Responsáveis' : 'Responsável'} valor={nomesDe(sp.responsaveis)} />
        <Campo rotulo="Emissão" valor={formatarData(sp.dataEmissao)} />
        <Campo rotulo="Entrega prevista" valor={formatarData(sp.dataPrevista)} />
        <Campo rotulo="Conclusão" valor={sp.dataConclusao ? formatarData(sp.dataConclusao) : '—'} />
      </dl>

      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Percentual de conclusão</span>
          <span className="tabular-nums">{sp.percentual}%</span>
        </div>
        <BarraProgresso pct={sp.percentual} />
      </div>

      <Bloco titulo="Objetivo">{sp.objetivo}</Bloco>
      {sp.pendencias && <Bloco titulo="Pendências">{sp.pendencias}</Bloco>}

      {sp.prorrogacao && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
            Prorrogação de {sp.prorrogacao.dias} dias —{' '}
            {sp.prorrogacao.situacao === 'pendente'
              ? 'aguardando aprovação'
              : sp.prorrogacao.situacao === 'aprovada'
                ? 'aprovada'
                : 'recusada'}
          </div>
          <p className="mt-1 text-muted-foreground">{sp.prorrogacao.motivo}</p>
        </div>
      )}

      {sp.anexos.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Anexos</h3>
          <ul className="flex flex-wrap gap-2">
            {sp.anexos.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  onClick={() => avisarSobDemanda(PRODUTO, 'Baixar anexos')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent"
                >
                  {a.endsWith('.pdf') ? (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                  {a}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Histórico</h3>
        <ol className="space-y-3 border-l border-border pl-4">
          {sp.eventos.map((e, i) => (
            <li key={i} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              <span className="font-medium">{nomeDe(e.pessoa)}</span> {EVENTO_LABEL[e.tipo]}
              <span className="ml-1.5 text-xs text-muted-foreground">{formatarData(e.data)}</span>
              {e.texto && <p className="mt-0.5 text-muted-foreground">{e.texto}</p>}
            </li>
          ))}
        </ol>
      </div>

      {acoes.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {acoes.map((acao, i) => (
            <button
              key={acao}
              type="button"
              onClick={() => avisarSobDemanda(PRODUTO, acao)}
              className={
                'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ' +
                (i === 0 ? 'bg-primary text-primary-foreground hover:opacity-90' : 'border border-border hover:bg-accent')
              }
            >
              {i === 0 && <Check className="h-4 w-4" aria-hidden="true" />}
              {acao}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 truncate">{valor}</dd>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}
