'use client';

import { useState, type FormEvent } from 'react';
import {
  CreditCard,
  Layers,
  Sparkles,
  Target,
  Wallet,
  PieChart,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  NEGOTIATION_OBJECTIVE,
  NEGOTIATION_OBJECTIVE_LABELS,
  SUPPLIER_MARKET_POSITION,
  SUPPLIER_MARKET_POSITION_LABELS,
  type NegotiationObjective,
  type NegotiationStrategyParams,
  type SupplierMarketPosition,
} from '@/lib/assistants/types';
import type { KraljicQuadrant } from '@/lib/assistants/types';

type Props = {
  initial?: Partial<NegotiationStrategyParams>;
  onSubmit: (params: NegotiationStrategyParams) => void;
  isLoading: boolean;
};

const KRALJIC_OPTIONS: { value: KraljicQuadrant; label: string }[] = [
  { value: 'estrategico', label: 'Estratégico (Alto impacto, Alto risco)' },
  { value: 'alavancavel', label: 'Alavancável (Alto impacto, Baixo risco)' },
  { value: 'gargalo', label: 'Gargalo (Baixo impacto, Alto risco)' },
  { value: 'nao-critico', label: 'Não Crítico (Baixo impacto, Baixo risco)' },
];

const LABEL_CLASS =
  'block text-xs font-medium text-foreground/80 mb-1.5';
const INPUT_CLASS =
  'w-full rounded-lg bg-card border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';
const SECTION_TITLE =
  'inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand mb-3';

export function NegotiationStrategyForm({
  initial,
  onSubmit,
  isLoading,
}: Props) {
  const [supplierName, setSupplierName] = useState(initial?.supplierName ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [supplierWebsite, setSupplierWebsite] = useState(
    initial?.supplierWebsite ?? '',
  );
  const [annualSpend, setAnnualSpend] = useState(initial?.annualSpend ?? '');
  const [supplierShare, setSupplierShare] = useState(
    initial?.supplierShare ?? '',
  );
  const [marketPosition, setMarketPosition] = useState<
    SupplierMarketPosition | ''
  >(initial?.marketPosition ?? '');
  const [kraljicQuadrant, setKraljicQuadrant] = useState<KraljicQuadrant | ''>(
    initial?.kraljicQuadrant ?? '',
  );
  const [currentPrice, setCurrentPrice] = useState(initial?.currentPrice ?? '');
  const [supplierDesiredPrice, setSupplierDesiredPrice] = useState(
    initial?.supplierDesiredPrice ?? '',
  );
  const [targetPrice, setTargetPrice] = useState(initial?.targetPrice ?? '');
  const [walkawayPrice, setWalkawayPrice] = useState(
    initial?.walkawayPrice ?? '',
  );
  const [strategicObjective, setStrategicObjective] = useState<
    NegotiationObjective | ''
  >(initial?.strategicObjective ?? '');
  const [contractStatus, setContractStatus] = useState(
    initial?.contractStatus ?? '',
  );
  const [priceScenario, setPriceScenario] = useState(
    initial?.priceScenario ?? '',
  );
  const [loadingExample, setLoadingExample] = useState(false);

  async function fillExample() {
    setLoadingExample(true);
    try {
      const res = await fetch('/api/assistants/negotiation/example?kind=strategy');
      if (!res.ok) {
        toast.error('Falha ao gerar exemplo');
        return;
      }
      const data = (await res.json()) as {
        params: NegotiationStrategyParams;
      };
      const p = data.params;
      setSupplierName(p.supplierName);
      setCategory(p.category);
      setSupplierWebsite(p.supplierWebsite ?? '');
      setAnnualSpend(p.annualSpend ?? '');
      setSupplierShare(p.supplierShare ?? '');
      setMarketPosition(p.marketPosition ?? '');
      setKraljicQuadrant(p.kraljicQuadrant ?? '');
      setCurrentPrice(p.currentPrice ?? '');
      setSupplierDesiredPrice(p.supplierDesiredPrice ?? '');
      setTargetPrice(p.targetPrice ?? '');
      setWalkawayPrice(p.walkawayPrice ?? '');
      setStrategicObjective(p.strategicObjective ?? '');
      setContractStatus(p.contractStatus ?? '');
      setPriceScenario(p.priceScenario ?? '');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro ao gerar exemplo', { description: msg });
    } finally {
      setLoadingExample(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supplierName.trim() || !category.trim() || isLoading) return;
    const params: NegotiationStrategyParams = {
      supplierName: supplierName.trim(),
      category: category.trim(),
      supplierWebsite: supplierWebsite.trim(),
      annualSpend: annualSpend.trim(),
      supplierShare: supplierShare.trim(),
      ...(marketPosition ? { marketPosition } : {}),
      ...(kraljicQuadrant ? { kraljicQuadrant } : {}),
      currentPrice: currentPrice.trim(),
      supplierDesiredPrice: supplierDesiredPrice.trim(),
      targetPrice: targetPrice.trim(),
      walkawayPrice: walkawayPrice.trim(),
      ...(strategicObjective ? { strategicObjective } : {}),
      contractStatus: contractStatus.trim(),
      priceScenario: priceScenario.trim(),
    };
    onSubmit(params);
  }

  const canSubmit =
    supplierName.trim().length > 0 && category.trim().length > 0 && !isLoading;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
          Construtor de Estratégia de Negociação
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Preencha os campos abaixo para que a IA crie uma estratégia de
          negociação personalizada.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={fillExample}
            disabled={loadingExample || isLoading}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-brand transition-colors disabled:opacity-50"
          >
            {loadingExample ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Gerar Exemplo
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-card p-5 md:p-7 space-y-7"
      >
        {/* IDENTIFICAÇÃO + CONTEXTO COMERCIAL (2 columns desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="space-y-4">
            <h2 className={SECTION_TITLE}>
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Identificação
            </h2>
            <div>
              <label className={LABEL_CLASS}>Nome do Fornecedor</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex: Global Corp"
                className={INPUT_CLASS}
                disabled={isLoading}
                required
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Categoria de Compra</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Logística"
                className={INPUT_CLASS}
                disabled={isLoading}
                required
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Website do Fornecedor ou Nome de Mercado
              </label>
              <input
                type="text"
                value={supplierWebsite}
                onChange={(e) => setSupplierWebsite(e.target.value)}
                placeholder="Ex: www.globalcorp.com"
                className={INPUT_CLASS}
                disabled={isLoading}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className={SECTION_TITLE}>
              <PieChart className="h-4 w-4" aria-hidden="true" />
              Contexto Comercial
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Spend Anual (Valor)</label>
                <input
                  type="text"
                  value={annualSpend}
                  onChange={(e) => setAnnualSpend(e.target.value)}
                  placeholder="Ex: R$ 4.500.000"
                  className={INPUT_CLASS}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Share do Fornecedor (%)</label>
                <input
                  type="text"
                  value={supplierShare}
                  onChange={(e) => setSupplierShare(e.target.value)}
                  placeholder="Ex: 70%"
                  className={INPUT_CLASS}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Posição do Fornecedor no Mercado
              </label>
              <select
                value={marketPosition}
                onChange={(e) =>
                  setMarketPosition(
                    (e.target.value || '') as SupplierMarketPosition | '',
                  )
                }
                className={INPUT_CLASS}
                disabled={isLoading}
              >
                <option value="">Selecione uma opção</option>
                {SUPPLIER_MARKET_POSITION.map((v) => (
                  <option key={v} value={v}>
                    {SUPPLIER_MARKET_POSITION_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Classificação na Matriz de Kraljic
              </label>
              <select
                value={kraljicQuadrant}
                onChange={(e) =>
                  setKraljicQuadrant(
                    (e.target.value || '') as KraljicQuadrant | '',
                  )
                }
                className={INPUT_CLASS}
                disabled={isLoading}
              >
                <option value="">Selecione uma opção</option>
                {KRALJIC_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>

        {/* ZOPA & PARÂMETROS FINANCEIROS */}
        <section className="space-y-4 border-t border-border pt-5">
          <h2 className={SECTION_TITLE}>
            <Wallet className="h-4 w-4" aria-hidden="true" />
            ZOPA & Parâmetros Financeiros
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={LABEL_CLASS}>Preço Atual (Seu Custo)</label>
              <input
                type="text"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="Ex: R$ 15.000.000"
                className={INPUT_CLASS}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Preço Desejado pelo Fornecedor (Estimativa)
              </label>
              <input
                type="text"
                value={supplierDesiredPrice}
                onChange={(e) => setSupplierDesiredPrice(e.target.value)}
                placeholder="Ex: R$ 15.500.000"
                className={INPUT_CLASS}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Preço Alvo (Sua meta ideal)</label>
              <input
                type="text"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Ex: R$ 13.800.000"
                className={INPUT_CLASS}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Preço de Abandono (Seu limite máximo)
              </label>
              <input
                type="text"
                value={walkawayPrice}
                onChange={(e) => setWalkawayPrice(e.target.value)}
                placeholder="Ex: R$ 14.200.000"
                className={INPUT_CLASS}
                disabled={isLoading}
              />
            </div>
          </div>
        </section>

        {/* OBJETIVOS E RELACIONAMENTO */}
        <section className="space-y-4 border-t border-border pt-5">
          <h2 className={SECTION_TITLE}>
            <Target className="h-4 w-4" aria-hidden="true" />
            Objetivos e Relacionamento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Objetivo Estratégico Principal</label>
              <select
                value={strategicObjective}
                onChange={(e) =>
                  setStrategicObjective(
                    (e.target.value || '') as NegotiationObjective | '',
                  )
                }
                className={INPUT_CLASS}
                disabled={isLoading}
              >
                <option value="">Selecione uma opção</option>
                {NEGOTIATION_OBJECTIVE.map((v) => (
                  <option key={v} value={v}>
                    {NEGOTIATION_OBJECTIVE_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Status do Contrato e Relacionamento
              </label>
              <textarea
                value={contractStatus}
                onChange={(e) => setContractStatus(e.target.value)}
                placeholder="Ex: Contrato expira em 6 meses. Relacionamento bom, mas preços 10% acima do mercado."
                rows={3}
                className={`${INPUT_CLASS} resize-none`}
                disabled={isLoading}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Cenário de Preços e Metas</label>
            <textarea
              value={priceScenario}
              onChange={(e) => setPriceScenario(e.target.value)}
              placeholder="Ex: Redução de 8% no próximo contrato."
              rows={2}
              className={`${INPUT_CLASS} resize-none`}
              disabled={isLoading}
            />
          </div>
        </section>

        <div className="flex justify-center pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-full bg-brand text-black h-12 px-7 text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Gerando…
              </>
            ) : (
              <>
                <Layers className="h-4 w-4" aria-hidden="true" />
                Gerar Estratégia
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
