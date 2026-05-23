'use client';

import { useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';
import {
  NEGOTIATION_PERSONA_PROFILE,
  NEGOTIATION_PERSONA_PROFILE_LABELS,
  type NegotiationPersonaProfile,
  type NegotiationSimulatorSetup,
} from '@/lib/assistants/types';

type Props = {
  supplierName: string;
  initial?: Partial<NegotiationSimulatorSetup>;
  onBack: () => void;
  onStart: (setup: NegotiationSimulatorSetup) => void;
  isLoading: boolean;
};

const LABEL_CLASS = 'block text-xs font-medium text-foreground/80 mb-1.5';
const INPUT_CLASS =
  'w-full rounded-lg bg-card border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';

export function NegotiationSimulatorSetupView({
  supplierName,
  initial,
  onBack,
  onStart,
  isLoading,
}: Props) {
  const [personaProfile, setPersonaProfile] = useState<NegotiationPersonaProfile | ''>(
    initial?.personaProfile ?? '',
  );
  const [supplierObjectives, setSupplierObjectives] = useState(
    initial?.supplierObjectives ?? '',
  );
  const [supplierWalkaway, setSupplierWalkaway] = useState(
    initial?.supplierWalkaway ?? '',
  );
  const [loadingExample, setLoadingExample] = useState(false);

  async function fillExample() {
    setLoadingExample(true);
    try {
      const res = await fetch('/api/assistants/negotiation/example?kind=setup');
      if (!res.ok) {
        toast.error('Falha ao gerar exemplo');
        return;
      }
      const data = (await res.json()) as { setup: NegotiationSimulatorSetup };
      setPersonaProfile(data.setup.personaProfile);
      setSupplierObjectives(data.setup.supplierObjectives);
      setSupplierWalkaway(data.setup.supplierWalkaway);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro', { description: msg });
    } finally {
      setLoadingExample(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!personaProfile || !supplierObjectives.trim() || !supplierWalkaway.trim() || isLoading) return;
    onStart({
      personaProfile,
      supplierObjectives: supplierObjectives.trim(),
      supplierWalkaway: supplierWalkaway.trim(),
    });
  }

  const canSubmit =
    personaProfile !== '' &&
    supplierObjectives.trim().length > 0 &&
    supplierWalkaway.trim().length > 0 &&
    !isLoading;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Voltar à estratégia
        </button>
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-brand">
            Simulador de Negociação por Texto
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure o perfil do fornecedor virtual para iniciar a simulação.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-5"
      >
        {/* Contexto carregado banner */}
        <div className="rounded-xl bg-brand/10 border border-brand/30 px-4 py-3 text-center">
          <div className="text-xs font-semibold text-brand">
            Contexto da Estratégia Carregado
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Você está negociando com{' '}
            <span className="font-medium text-foreground">{supplierName}</span>.
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>
            Perfil de Negociação do Fornecedor
          </label>
          <select
            value={personaProfile}
            onChange={(e) =>
              setPersonaProfile(
                (e.target.value || '') as NegotiationPersonaProfile | '',
              )
            }
            className={INPUT_CLASS}
            disabled={isLoading}
            required
          >
            <option value="">Selecione uma opção</option>
            {NEGOTIATION_PERSONA_PROFILE.map((p) => (
              <option key={p} value={p}>
                {NEGOTIATION_PERSONA_PROFILE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>
            Principais Objetivos do Fornecedor
          </label>
          <textarea
            value={supplierObjectives}
            onChange={(e) => setSupplierObjectives(e.target.value)}
            placeholder="Ex: Manter o status de fornecedor principal, introduzir nosso novo chipset…"
            rows={4}
            className={`${INPUT_CLASS} resize-none`}
            disabled={isLoading}
            required
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            O que o fornecedor quer alcançar nesta negociação?
          </p>
        </div>

        <div>
          <label className={LABEL_CLASS}>
            Limites Mínimos / Pontos de Saída do Fornecedor
          </label>
          <textarea
            value={supplierWalkaway}
            onChange={(e) => setSupplierWalkaway(e.target.value)}
            placeholder="Ex: Não podemos oferecer mais de 5% de desconto…"
            rows={4}
            className={`${INPUT_CLASS} resize-none`}
            disabled={isLoading}
            required
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Quais são as condições mínimas que o fornecedor aceitaria?
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button
            type="button"
            onClick={fillExample}
            disabled={loadingExample || isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card hover:bg-accent h-10 px-4 text-xs font-medium text-foreground transition-all duration-300 active:scale-95 disabled:opacity-50"
          >
            {loadingExample ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Gerar Exemplo
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand text-black hover:bg-brand/90 h-11 px-5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-300"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Iniciando…
              </>
            ) : (
              <>
                <Target className="h-4 w-4" aria-hidden="true" />
                Iniciar Simulação
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
