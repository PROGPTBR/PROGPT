'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  UF_INFO,
  UF_LIST,
  calcularDifal,
  compararOrigens,
  type Finalidade,
  type UF,
} from '@/lib/simulador-logistico/difal';
import { DIFAL_DISCLAIMER } from '@/lib/legal/disclaimers';

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

const FINALIDADE_OPTIONS: Array<{ value: Finalidade; label: string }> = [
  { value: 'uso_consumo', label: 'Uso e consumo' },
  { value: 'ativo_imobilizado', label: 'Ativo imobilizado' },
  { value: 'revenda', label: 'Revenda' },
];

type Cenario = { id: string; ufOrigem: UF | ''; frete: string };

let cenarioSeq = 0;
function novoCenario(): Cenario {
  cenarioSeq += 1;
  return { id: `c${cenarioSeq}`, ufOrigem: '', frete: '' };
}

const selectClass =
  'w-full rounded-md border border-input bg-background p-2 text-sm';
const labelClass = 'text-xs font-medium block mb-1';

export function DifalSimulator() {
  const [valor, setValor] = useState('');
  const [ufOrigem, setUfOrigem] = useState<UF | ''>('');
  const [ufDestino, setUfDestino] = useState<UF | ''>('');
  const [importado, setImportado] = useState(false);
  const [finalidade, setFinalidade] = useState<Finalidade>('uso_consumo');
  const [aliquotaInternaDestino, setAliquotaInternaDestino] = useState('');
  const [fcp, setFcp] = useState('');
  const [cenarios, setCenarios] = useState<Cenario[]>([novoCenario()]);

  // Repreenche os defaults sempre que a UF de destino muda — se o usuário
  // já tinha editado manualmente, a edição vale até a próxima troca de UF.
  useEffect(() => {
    if (!ufDestino) return;
    const info = UF_INFO[ufDestino];
    setAliquotaInternaDestino(String(info.aliquotaInterna));
    setFcp(String(info.fcp));
  }, [ufDestino]);

  const valorNum = Number(valor.replace(',', '.'));
  const aliquotaDestinoNum = Number(aliquotaInternaDestino.replace(',', '.'));
  const fcpNum = Number(fcp.replace(',', '.'));

  const pronto =
    valorNum > 0 &&
    !!ufOrigem &&
    !!ufDestino &&
    Number.isFinite(aliquotaDestinoNum) &&
    Number.isFinite(fcpNum);

  const resultado = useMemo(() => {
    if (!pronto || !ufOrigem || !ufDestino) return null;
    return calcularDifal({
      valor: valorNum,
      ufOrigem,
      ufDestino,
      importado,
      aliquotaInternaDestino: aliquotaDestinoNum,
      fcp: fcpNum,
      finalidade,
    });
  }, [pronto, valorNum, ufOrigem, ufDestino, importado, aliquotaDestinoNum, fcpNum, finalidade]);

  const cenariosValidos = cenarios.filter((c): c is Cenario & { ufOrigem: UF } => !!c.ufOrigem);

  const comparacao = useMemo(() => {
    if (!ufDestino || valorNum <= 0 || cenariosValidos.length === 0) return [];
    return compararOrigens({
      valor: valorNum,
      ufDestino,
      importado,
      finalidade,
      aliquotaInternaDestino: Number.isFinite(aliquotaDestinoNum) ? aliquotaDestinoNum : undefined,
      fcp: Number.isFinite(fcpNum) ? fcpNum : undefined,
      cenarios: cenariosValidos.map((c) => ({
        ufOrigem: c.ufOrigem,
        freteInformado: c.frete ? Number(c.frete.replace(',', '.')) : undefined,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ufDestino, valorNum, importado, finalidade, aliquotaDestinoNum, fcpNum, JSON.stringify(cenariosValidos)]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient-soft text-brand">
          <Truck className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          Simulador Logístico (DIFAL)
        </h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground max-w-2xl">
        Calcule o diferencial de alíquota do ICMS (DIFAL) de uma compra
        interestadual e compare o custo total de comprar de diferentes UFs de
        origem.
      </p>

      <div className="rounded-md border border-border bg-card p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>
              Valor da mercadoria (R$) <span className="text-destructive">*</span>
            </label>
            <Input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex: 10000"
            />
          </div>
          <div>
            <label className={labelClass}>
              UF de origem (fornecedor) <span className="text-destructive">*</span>
            </label>
            <select
              className={selectClass}
              value={ufOrigem}
              onChange={(e) => setUfOrigem(e.target.value as UF | '')}
            >
              <option value="">Selecione</option>
              {UF_LIST.map((uf) => (
                <option key={uf} value={uf}>
                  {uf} — {UF_INFO[uf].nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>
              UF de destino (sua empresa) <span className="text-destructive">*</span>
            </label>
            <select
              className={selectClass}
              value={ufDestino}
              onChange={(e) => setUfDestino(e.target.value as UF | '')}
            >
              <option value="">Selecione</option>
              {UF_LIST.map((uf) => (
                <option key={uf} value={uf}>
                  {uf} — {UF_INFO[uf].nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Finalidade da compra</label>
            <select
              className={selectClass}
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value as Finalidade)}
            >
              {FINALIDADE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Alíquota interna destino (%)</label>
            <Input
              inputMode="decimal"
              value={aliquotaInternaDestino}
              onChange={(e) => setAliquotaInternaDestino(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>FCP destino (%)</label>
            <Input
              inputMode="decimal"
              value={fcp}
              onChange={(e) => setFcp(e.target.value)}
            />
          </div>
          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={importado}
                onChange={(e) => setImportado(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Bem importado / conteúdo de importação &gt; 40%
            </label>
          </div>
        </div>
      </div>

      {resultado && (
        <div className="mt-6 rounded-md border border-border bg-card p-6">
          <h2 className="text-sm font-semibold mb-4">Resultado</h2>

          {resultado.mesmoEstado && (
            <p className="mb-4 text-xs text-muted-foreground">
              Origem e destino são a mesma UF — não há operação interestadual,
              logo não existe DIFAL a recolher aqui.
            </p>
          )}
          {resultado.avisoRevenda && (
            <p className="mb-4 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Finalidade &quot;Revenda&quot;: normalmente não há DIFAL nessa operação —
              a mercadoria será revendida com ICMS próprio na saída. O número
              abaixo é calculado mesmo assim, a título de referência.
            </p>
          )}

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            <ResultItem label="Alíquota interestadual" value={`${formatPct(resultado.aliquotaInterestadual)}%`} />
            <ResultItem label="Alíquota interna destino" value={`${formatPct(resultado.aliquotaInternaDestino)}%`} />
            <ResultItem label="Base ICMS origem" value={`R$ ${formatBRL(resultado.baseOrigem)}`} />
            <ResultItem label="ICMS origem" value={`R$ ${formatBRL(resultado.icmsOrigem)}`} />
            <ResultItem label="Base ICMS destino" value={`R$ ${formatBRL(resultado.baseDestino)}`} />
            <ResultItem label="ICMS destino" value={`R$ ${formatBRL(resultado.icmsDestino)}`} />
            <ResultItem label="FCP" value={`R$ ${formatBRL(resultado.fcpValor)}`} />
            <ResultItem label="DIFAL (ICMS)" value={`R$ ${formatBRL(resultado.difal)}`} />
          </dl>

          <div className="mt-4 rounded-md bg-brand/10 border border-brand/30 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium">Total a recolher</span>
            <span className="text-lg font-semibold text-brand">
              R$ {formatBRL(resultado.totalRecolher)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-md border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">
            Comparar outras origens ({ufDestino ? `destino ${ufDestino}` : 'defina o destino acima'})
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCenarios((cs) => [...cs, novoCenario()])}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Comparar outra origem
          </Button>
        </div>

        <div className="space-y-2">
          {cenarios.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <select
                className={`${selectClass} max-w-[220px]`}
                value={c.ufOrigem}
                onChange={(e) =>
                  setCenarios((cs) =>
                    cs.map((x) => (x.id === c.id ? { ...x, ufOrigem: e.target.value as UF | '' } : x)),
                  )
                }
              >
                <option value="">UF de origem</option>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf} — {UF_INFO[uf].nome}
                  </option>
                ))}
              </select>
              <Input
                inputMode="decimal"
                placeholder="Frete cotado (R$, opcional)"
                value={c.frete}
                onChange={(e) =>
                  setCenarios((cs) =>
                    cs.map((x) => (x.id === c.id ? { ...x, frete: e.target.value } : x)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remover cenário"
                onClick={() => setCenarios((cs) => cs.filter((x) => x.id !== c.id))}
                disabled={cenarios.length === 1}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Não estimamos frete — não há fonte pública confiável de tarifa de
          frete no Brasil. Informe o valor que você já cotou com cada
          transportadora/fornecedor pra comparar o custo total pousado.
        </p>

        {comparacao.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Origem</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">DIFAL + FCP</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Frete informado</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {comparacao.map((c, i) => (
                  <tr
                    key={c.ufOrigem}
                    className={`border-b border-border/60 last:border-0 ${i === 0 ? 'bg-brand/5' : ''}`}
                  >
                    <td className="px-3 py-1.5">
                      {c.ufOrigem} — {UF_INFO[c.ufOrigem].nome}
                      {i === 0 && (
                        <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">
                          menor custo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      R$ {formatBRL(c.totalRecolher)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      R$ {formatBRL(c.freteInformado)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                      R$ {formatBRL(c.totalComFrete)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
        {DIFAL_DISCLAIMER}
      </p>
    </div>
  );
}

function ResultItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
