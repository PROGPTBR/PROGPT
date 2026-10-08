'use client';

import { Fragment, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, FileSpreadsheet, Plus, Printer, Upload } from 'lucide-react';

import {
  Abas,
  AvisoDemonstracao,
  BarraProgresso,
  GraficoColunas,
  Kpi,
  ListaBarras,
  Secao,
  Selo,
  VitrineCabecalho,
  avisarSobDemanda,
  useAbaDoTour,
  formatarBRL,
  formatarBRLCurto,
  formatarNumero,
  type TomSelo,
} from '@/components/vitrine/ui';
import { dataDeIso } from '@/lib/vitrine/datas';
import {
  COLUNAS_KANBAN,
  CONTRATOS,
  OBRAS,
  OBRA_INICIAL_ID,
  STATUS_MEDICAO_LABEL,
  STATUS_OBRA_LABEL,
  contratoPorId,
  indicadoresCockpit,
  linhasDaMedicao,
  medicaoConta,
  medidoPorMes,
  obraPorId,
  obrasDoContrato,
  precoUnitarioFinal,
  resumoDaObra,
  rotuloMes,
  valorDaMedicao,
  valorServico,
  type Contrato,
  type Obra,
  type ResumoObra,
  type StatusMedicao,
  type StatusObra,
} from '@/lib/vitrine/obras';

const PRODUTO = 'gestao_obras' as const;

type AbaId = 'cockpit' | 'contratos' | 'medicoes' | 'planejamento';

const ABAS: { id: AbaId; label: string }[] = [
  { id: 'cockpit', label: 'Visão geral' },
  { id: 'contratos', label: 'Contratos e obras' },
  { id: 'medicoes', label: 'Medições' },
  { id: 'planejamento', label: 'Planejamento' },
];
const IDS_ABAS = ABAS.map((a) => a.id);

const TOM_OBRA: Record<StatusObra, TomSelo> = { ATIVA: 'azul', CONCLUIDA: 'verde', SUSPENSA: 'amarelo' };
const TOM_MEDICAO: Record<StatusMedicao, TomSelo> = { RASCUNHO: 'cinza', ENVIADA: 'amarelo', APROVADA: 'verde' };

const contratoDe = (obra: Obra) => contratoPorId(obra.contratoId)!;

function SeloPrazo({ resumo }: { resumo: ResumoObra }) {
  if (resumo.diasRestantes === null) return <Selo tom="verde">Entregue</Selo>;
  if (resumo.diasRestantes < 0) return <Selo tom="vermelho">{Math.abs(resumo.diasRestantes)} dias vencido</Selo>;
  if (resumo.diasRestantes <= 60) return <Selo tom="amarelo">{resumo.diasRestantes} dias restantes</Selo>;
  return <Selo tom="verde">{resumo.diasRestantes} dias restantes</Selo>;
}

export function GestaoObrasDemo({ hojeIso }: { hojeIso: string }) {
  const now = useMemo(() => dataDeIso(hojeIso), [hojeIso]);
  const [aba, setAba] = useState<AbaId>('cockpit');
  useAbaDoTour(IDS_ABAS, setAba);
  // Obra em foco compartilhada entre Medições e Planejamento (a ficha da obra
  // leva direto para elas já com a obra escolhida).
  const [obraFoco, setObraFoco] = useState<string>(OBRA_INICIAL_ID);

  const irPara = (destino: AbaId, obraId: string) => {
    setObraFoco(obraId);
    setAba(destino);
  };

  return (
    <>
      <VitrineCabecalho
        produto={PRODUTO}
        titulo="Gestão de Obras"
        descricao="Contratos com órgãos públicos, planilha orçamentária, boletins de medição e planejamento das frentes de serviço, com a visão financeira de toda a carteira de obras."
      />
      <AvisoDemonstracao produto={PRODUTO} />
      <Abas abas={ABAS} ativa={aba} onChange={setAba} />

      {aba === 'cockpit' && <Cockpit now={now} onAbrirObra={(id) => irPara('medicoes', id)} />}
      {aba === 'contratos' && <ContratosEObras now={now} onIrPara={irPara} />}
      {aba === 'medicoes' && <Medicoes now={now} obraId={obraFoco} onTrocarObra={setObraFoco} />}
      {aba === 'planejamento' && <Planejamento obraId={obraFoco} onTrocarObra={setObraFoco} />}
    </>
  );
}

// ─── Visão geral (cockpit) ────────────────────────────────────────────────

function Cockpit({ now, onAbrirObra }: { now: Date; onAbrirObra: (obraId: string) => void }) {
  const ind = indicadoresCockpit(OBRAS, CONTRATOS, now);
  const serie = medidoPorMes(OBRAS, CONTRATOS, now, 6);
  const linhas = OBRAS.map((obra) => ({ obra, resumo: resumoDaObra(obra, contratoDe(obra), now) }));

  return (
    <div className="space-y-4">
      <div data-tour="obras-kpis" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Contratos ativos" valor={String(ind.contratosAtivos)} />
        <Kpi label="Obras em execução" valor={String(ind.obrasEmExecucao)} detalhe={`de ${OBRAS.length} obras`} />
        <Kpi label="Valor contratado" valor={formatarBRLCurto(ind.valorContratado)} />
        <Kpi
          label="Medido acumulado"
          valor={formatarBRLCurto(ind.valorMedido)}
          detalhe={`${formatarNumero(ind.avanco, 1)}% da carteira`}
          tom="positivo"
        />
        <Kpi label="Saldo a medir" valor={formatarBRLCurto(ind.saldoAMedir)} />
        <Kpi label="Aguardando o órgão" valor={formatarBRLCurto(ind.aguardandoAprovacao)} detalhe="BMs enviados" />
      </div>

      <div data-tour="obras-graficos" className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Secao titulo="Medido por mês (enviado + aprovado)">
          <GraficoColunas serie={serie} formatar={formatarBRLCurto} />
        </Secao>
        <Secao titulo="Avanço físico-financeiro por obra">
          <ListaBarras
            linhas={linhas.map(({ obra, resumo }) => ({ label: obra.nome, valor: resumo.avanco }))}
            formatar={(n) => `${formatarNumero(n, 1)}%`}
          />
        </Secao>
      </div>

      <Secao data-tour="obras-carteira" titulo="Carteira de obras">
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium sm:px-5">Obra</th>
                <th className="px-2 py-2 font-medium">Órgão</th>
                <th className="px-2 py-2 font-medium">Responsável</th>
                <th className="w-40 px-2 py-2 font-medium">Avanço</th>
                <th className="px-2 py-2 text-right font-medium">Contratado</th>
                <th className="px-4 py-2 font-medium sm:px-5">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ obra, resumo }) => (
                <tr key={obra.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 sm:px-5">
                    <button type="button" onClick={() => onAbrirObra(obra.id)} className="text-left font-medium hover:underline">
                      {obra.nome}
                    </button>
                    <div className="mt-0.5">
                      <Selo tom={TOM_OBRA[obra.status]}>{STATUS_OBRA_LABEL[obra.status]}</Selo>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-muted-foreground">{contratoDe(obra).orgao}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground">{obra.engenheiro}</td>
                  <td className="px-2 py-2.5">
                    <div className="mb-1 text-xs tabular-nums">{formatarNumero(resumo.avanco, 1)}%</div>
                    <BarraProgresso pct={resumo.avanco} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{formatarBRL(resumo.valorContratado)}</td>
                  <td className="px-4 py-2.5 sm:px-5">
                    <SeloPrazo resumo={resumo} />
                    <div className="mt-0.5 text-[11px] text-muted-foreground">até {resumo.terminoPrevisto}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </div>
  );
}

// ─── Contratos → obras → ficha da obra ────────────────────────────────────

function ContratosEObras({ now, onIrPara }: { now: Date; onIrPara: (aba: AbaId, obraId: string) => void }) {
  const [contratoId, setContratoId] = useState<string | null>(null);
  const [obraId, setObraId] = useState<string | null>(null);

  const contrato = contratoId ? contratoPorId(contratoId) : undefined;
  const obra = obraId ? OBRAS.find((o) => o.id === obraId) : undefined;

  if (contrato && obra) {
    return (
      <FichaDaObra
        obra={obra}
        contrato={contrato}
        now={now}
        onVoltar={() => setObraId(null)}
        onIrPara={onIrPara}
      />
    );
  }

  if (contrato) {
    const obras = obrasDoContrato(contrato.id);
    return (
      <div className="space-y-4">
        <Voltar onClick={() => setContratoId(null)}>Contratos</Voltar>
        <Secao titulo={`Contrato nº ${contrato.numero}`}>
          <p className="font-medium">{contrato.objeto}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <Campo rotulo="Órgão" valor={contrato.orgao} />
            <Campo rotulo="Unidade" valor={contrato.orgaoSubdivisao} />
            <Campo rotulo="BDI" valor={`${formatarNumero(contrato.bdi * 100)}%`} />
            <Campo rotulo="Desconto da licitação" valor={`${formatarNumero(contrato.desconto * 100)}%`} />
          </dl>
        </Secao>
        <div className="grid gap-3 md:grid-cols-2">
          {obras.map((o) => {
            const resumo = resumoDaObra(o, contrato, now);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setObraId(o.id)}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium">{o.nome}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.local}</p>
                  </div>
                  <Selo tom={TOM_OBRA[o.status]}>{STATUS_OBRA_LABEL[o.status]}</Selo>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {formatarBRLCurto(resumo.valorMedido)} de {formatarBRLCurto(resumo.valorContratado)}
                    </span>
                    <span className="tabular-nums">{formatarNumero(resumo.avanco, 1)}%</span>
                  </div>
                  <BarraProgresso pct={resumo.avanco} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{o.engenheiro}</span>
                  <SeloPrazo resumo={resumo} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div data-tour="obras-contratos" className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => avisarSobDemanda(PRODUTO, 'Cadastrar contrato')}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo contrato
        </button>
      </div>
      {CONTRATOS.map((c) => {
        const obras = obrasDoContrato(c.id);
        const resumos = obras.map((o) => resumoDaObra(o, c, now));
        const contratado = resumos.reduce((s, r) => s + r.valorContratado, 0);
        const medido = resumos.reduce((s, r) => s + r.valorMedido, 0);
        const avanco = contratado ? (medido / contratado) * 100 : 0;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setContratoId(c.id)}
            className="grid w-full gap-3 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">Nº {c.numero}</span>
                <Selo tom={c.tipo === 'ESTADO' ? 'roxo' : 'azul'}>{c.tipo === 'ESTADO' ? 'Estado' : 'Prefeitura'}</Selo>
                <span className="text-xs text-muted-foreground">
                  {obras.length} {obras.length === 1 ? 'obra' : 'obras'}
                </span>
              </div>
              <h3 className="mt-1 font-medium">{c.objeto}</h3>
              <p className="truncate text-xs text-muted-foreground">
                {c.orgao} · {c.cidade}/{c.uf}
              </p>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">{formatarBRLCurto(contratado)}</span>
                <span className="tabular-nums">{formatarNumero(avanco, 1)}%</span>
              </div>
              <BarraProgresso pct={avanco} />
            </div>
            <ChevronRight className="hidden h-5 w-5 text-muted-foreground sm:block" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function FichaDaObra({
  obra,
  contrato,
  now,
  onVoltar,
  onIrPara,
}: {
  obra: Obra;
  contrato: Contrato;
  now: Date;
  onVoltar: () => void;
  onIrPara: (aba: AbaId, obraId: string) => void;
}) {
  const resumo = resumoDaObra(obra, contrato, now);

  return (
    <div className="space-y-4">
      <Voltar onClick={onVoltar}>Obras do contrato nº {contrato.numero}</Voltar>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{obra.nome}</h2>
            <Selo tom={TOM_OBRA[obra.status]}>{STATUS_OBRA_LABEL[obra.status]}</Selo>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {obra.local} · {obra.engenheiro} · término previsto {resumo.terminoPrevisto}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onIrPara('medicoes', obra.id)}
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent"
          >
            Medições
          </button>
          <button
            type="button"
            onClick={() => onIrPara('planejamento', obra.id)}
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent"
          >
            Planejamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Valor contratado" valor={formatarBRL(resumo.valorContratado)} />
        <Kpi label="Medido" valor={formatarBRL(resumo.valorMedido)} tom="positivo" />
        <Kpi label="Saldo a medir" valor={formatarBRL(resumo.saldo)} />
        <Kpi label="Avanço" valor={`${formatarNumero(resumo.avanco, 1)}%`} detalhe={`${obra.medicoes.length} boletins`} />
      </div>

      <Secao
        titulo="Planilha orçamentária"
        acoes={
          <button
            type="button"
            onClick={() => avisarSobDemanda(PRODUTO, 'Importar planilha do órgão')}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-accent"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Importar planilha
          </button>
        }
      >
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
          Preço unitário com BDI de {formatarNumero(contrato.bdi * 100)}% e desconto de{' '}
          {formatarNumero(contrato.desconto * 100)}% da licitação.
        </p>
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium sm:px-5">Item</th>
                <th className="px-2 py-2 font-medium">Fonte</th>
                <th className="px-2 py-2 font-medium">Descrição</th>
                <th className="px-2 py-2 font-medium">Un</th>
                <th className="px-2 py-2 text-right font-medium">Quantidade</th>
                <th className="px-2 py-2 text-right font-medium">Preço unit.</th>
                <th className="px-4 py-2 text-right font-medium sm:px-5">Total</th>
              </tr>
            </thead>
            <tbody>
              {obra.grupos.map((grupo) => {
                const servicos = obra.servicos.filter((s) => s.grupo === grupo.item);
                const subtotal = servicos.reduce((soma, s) => soma + valorServico(s, contrato), 0);
                return (
                  <Fragment key={grupo.item}>
                    <tr className="bg-muted/50 font-medium">
                      <td className="px-4 py-2 sm:px-5">{grupo.item}</td>
                      <td className="px-2 py-2" colSpan={5}>
                        {grupo.descricao.toUpperCase()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums sm:px-5">{formatarBRL(subtotal)}</td>
                    </tr>
                    {servicos.map((s) => (
                      <tr key={s.item} className="border-b border-border/60">
                        <td className="px-4 py-2 tabular-nums text-muted-foreground sm:px-5">{s.item}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">
                          {s.fonte} {s.codigo}
                        </td>
                        <td className="px-2 py-2">{s.descricao}</td>
                        <td className="px-2 py-2 text-muted-foreground">{s.unidade}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatarNumero(s.quantidade)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {formatarBRL(precoUnitarioFinal(s.precoUnitario, contrato.bdi, contrato.desconto))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums sm:px-5">
                          {formatarBRL(valorServico(s, contrato))}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="px-4 py-3 sm:px-5" colSpan={6}>
                  Total da obra
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums sm:px-5">
                  {formatarBRL(resumo.valorContratado)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Secao>
    </div>
  );
}

// ─── Medições ─────────────────────────────────────────────────────────────

function SeletorObra({ obraId, onTrocar }: { obraId: string; onTrocar: (id: string) => void }) {
  return (
    <select
      aria-label="Obra"
      value={obraId}
      onChange={(e) => onTrocar(e.target.value)}
      className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm sm:w-auto sm:min-w-[320px]"
    >
      {CONTRATOS.map((c) => (
        <optgroup key={c.id} label={`Contrato ${c.numero}, ${c.orgao}`}>
          {obrasDoContrato(c.id).map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function Medicoes({ now, obraId, onTrocarObra }: { now: Date; obraId: string; onTrocarObra: (id: string) => void }) {
  const obra = obraPorId(obraId);
  const contrato = contratoDe(obra);
  const ultima = obra.medicoes[obra.medicoes.length - 1]?.numero ?? 1;
  const [escolhida, setEscolhida] = useState<{ obra: string; numero: number }>({ obra: obra.id, numero: ultima });
  // Trocar de obra volta para o boletim mais recente dela.
  const numero = escolhida.obra === obra.id ? escolhida.numero : ultima;
  const medicao = obra.medicoes.find((m) => m.numero === numero)!;

  const linhas = linhasDaMedicao(obra, contrato, numero).filter((l) => l.quantidadeAcumulada > 0);
  const totalBm = valorDaMedicao(obra, contrato, numero);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SeletorObra obraId={obra.id} onTrocar={onTrocarObra} />
        <button
          type="button"
          onClick={() => avisarSobDemanda(PRODUTO, 'Abrir nova medição')}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova medição
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav data-tour="obras-bms" aria-label="Boletins de medição" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {[...obra.medicoes].reverse().map((m) => {
            const ativo = m.numero === numero;
            return (
              <button
                key={m.numero}
                type="button"
                aria-pressed={ativo}
                onClick={() => setEscolhida({ obra: obra.id, numero: m.numero })}
                className={
                  'shrink-0 rounded-xl border p-3 text-left transition-colors ' +
                  (ativo ? 'border-brand bg-brand/5' : 'border-border bg-card hover:bg-accent/50')
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">BM {String(m.numero).padStart(2, '0')}</span>
                  <Selo tom={TOM_MEDICAO[m.status]}>{STATUS_MEDICAO_LABEL[m.status]}</Selo>
                </div>
                <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
                  <span>{rotuloMes(now, m.mes)}</span>
                  <span className="tabular-nums">{formatarBRLCurto(valorDaMedicao(obra, contrato, m.numero))}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <Secao data-tour="obras-boletim"
          titulo={`Boletim de medição nº ${String(numero).padStart(2, '0')}, ${rotuloMes(now, medicao.mes)}`}
          acoes={
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => avisarSobDemanda(PRODUTO, 'Gerar o PDF do boletim')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-accent"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => avisarSobDemanda(PRODUTO, 'Exportar o boletim em Excel')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-accent"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                Excel
              </button>
            </div>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Selo tom={TOM_MEDICAO[medicao.status]}>{STATUS_MEDICAO_LABEL[medicao.status]}</Selo>
            <span>{contrato.orgao}</span>
            {!medicaoConta(medicao.status) && <span>· rascunho ainda não entra no medido acumulado</span>}
          </div>
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 bg-card px-4 py-2 font-medium sm:px-5">Item</th>
                  <th className="px-2 py-2 font-medium">Descrição</th>
                  <th className="px-2 py-2 font-medium">Un</th>
                  <th className="px-2 py-2 text-right font-medium">Contratado</th>
                  <th className="px-2 py-2 text-right font-medium">Anterior</th>
                  <th className="px-2 py-2 text-right font-medium">Nesta medição</th>
                  <th className="px-2 py-2 text-right font-medium">Acumulado</th>
                  <th className="px-2 py-2 text-right font-medium">%</th>
                  <th className="px-4 py-2 text-right font-medium sm:px-5">Valor do BM</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.servico.item} className="border-b border-border/60">
                    <td className="sticky left-0 bg-card px-4 py-2 tabular-nums text-muted-foreground sm:px-5">{l.servico.item}</td>
                    <td className="max-w-[260px] truncate px-2 py-2" title={l.servico.descricao}>
                      {l.servico.descricao}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{l.servico.unidade}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatarNumero(l.servico.quantidade)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-muted-foreground">
                      {formatarNumero(l.quantidadeAnterior)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">
                      {l.quantidadeMedicao ? formatarNumero(l.quantidadeMedicao) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatarNumero(l.quantidadeAcumulada)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatarNumero(l.percentualAcumulado, 1)}%</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums sm:px-5">
                      {l.valorMedicao ? formatarBRL(l.valorMedicao) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="sticky left-0 bg-card px-4 py-3 sm:px-5" colSpan={8}>
                    Total deste boletim
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums sm:px-5">{formatarBRL(totalBm)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Secao>
      </div>
    </div>
  );
}

// ─── Planejamento (Kanban por quinzena) ───────────────────────────────────

function Planejamento({ obraId, onTrocarObra }: { obraId: string; onTrocarObra: (id: string) => void }) {
  const obra = obraPorId(obraId);
  const [quinzena, setQuinzena] = useState<1 | 2>(1);
  const tarefas = obra.kanban.filter((t) => t.quinzena === quinzena);
  const servico = (item: string) => obra.servicos.find((s) => s.item === item);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SeletorObra obraId={obra.id} onTrocar={onTrocarObra} />
        <div className="flex gap-2">
          <div role="tablist" className="inline-flex rounded-lg bg-muted p-1">
            {([1, 2] as const).map((q) => (
              <button
                key={q}
                type="button"
                role="tab"
                aria-selected={quinzena === q}
                onClick={() => setQuinzena(q)}
                className={
                  'rounded-md px-3 py-1 text-xs font-medium ' +
                  (quinzena === q ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')
                }
              >
                {q === 1 ? '1ª quinzena (1-15)' : '2ª quinzena (16-fim)'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => avisarSobDemanda(PRODUTO, 'Planejar um serviço')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Planejar</span>
          </button>
        </div>
      </div>

      {obra.status === 'CONCLUIDA' ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Obra concluída, sem frentes de serviço em planejamento.
        </p>
      ) : (
        <div data-tour="obras-kanban" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS_KANBAN.map((col) => {
            const daColuna = tarefas.filter((t) => t.coluna === col.id);
            return (
              <div key={col.id} className="flex min-w-0 flex-col rounded-xl bg-muted/60 p-2">
                <div className="flex items-center justify-between px-1.5 pb-2 pt-1">
                  <h3 className="text-sm font-medium">{col.label}</h3>
                  <span className="text-xs tabular-nums text-muted-foreground">{daColuna.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {daColuna.length === 0 && (
                    <p className="px-1.5 py-3 text-center text-xs text-muted-foreground">Nada aqui.</p>
                  )}
                  {daColuna.map((t) => {
                    const s = servico(t.servico);
                    return (
                      <div key={t.id} className="rounded-lg border border-border bg-card p-2.5 text-xs">
                        <div className="font-medium leading-snug">{t.titulo}</div>
                        {s && (
                          <div className="mt-1 text-muted-foreground">
                            {s.item} · {s.descricao}
                          </div>
                        )}
                        <div className="mt-2 text-muted-foreground">{t.responsavel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Miúdos ───────────────────────────────────────────────────────────────

function Voltar({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5">{valor}</dd>
    </div>
  );
}
