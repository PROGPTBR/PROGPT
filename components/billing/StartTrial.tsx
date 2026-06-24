'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { isValidCpf, formatCpf } from '@/lib/validators/cpf';

// Sub-projeto 36.1 — tela de cadastro OBRIGATÓRIO do cartão pra liberar o
// trial. É o gate por onde todo novo usuário passa antes de usar o bot/
// assistentes. Coleta Nome + CPF (Asaas exige cpfCnpj) + telefone, chama
// /api/billing/checkout e redireciona pro hosted checkout do Asaas (cartão).

type Props = {
  priceLabel: string;
  trialDays: number;
  initial: {
    full_name?: string | null;
    cpf_cnpj?: string | null;
    phone?: string | null;
    professional_requirement?: string | null;
  } | null;
};

function maskCPF(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
}

function maskPhone(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return numbers.replace(/^(\d{2})(\d+)/, '($1) $2');
  return numbers.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
}

const PERKS = [
  'Acesso total ao chat e aos 8 assistentes',
  'Sem cobrança durante os dias grátis',
  'Cancele quando quiser, em 1 clique',
];

export function StartTrial({ priceLabel, trialDays, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.full_name ?? '');
  const [cpfInput, setCpfInput] = useState(
    initial?.cpf_cnpj ? maskCPF(initial.cpf_cnpj) : '',
  );
  const [phone, setPhone] = useState(
    initial?.phone ? maskPhone(initial.phone) : '',
  );
  const [professionalRequirement, setProfessionalRequirement] = useState(
    initial?.professional_requirement ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cpfClean = formatCpf(cpfInput);
  const cpfOk = isValidCpf(cpfClean);
  const nameOk = name.trim().length >= 2;
  const canSubmit = cpfOk && nameOk && !busy;

  const INPUT =
    'w-full rounded-lg bg-muted/40 border border-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';
  const LABEL =
    'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/billing/checkout?plan=pf-99', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          cpf: cpfClean,
          phone: phone.replace(/\D/g, ''),
          professionalRequirement,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        if (body.error === 'already_subscribed') {
          toast.info('Você já tem uma assinatura ativa.');
          router.push('/chat');
          return;
        }
        if (body.error === 'checkout_in_progress') {
          setError(
            'Já há um cadastro de cartão em andamento. Conclua no Asaas ou aguarde alguns minutos.',
          );
          setBusy(false);
          return;
        }
        if (body.error === 'invalid_cpf') {
          setError('CPF inválido — verifique os dígitos.');
          setBusy(false);
          return;
        }
        setError('Não foi possível iniciar o cadastro. Tente novamente.');
        setBusy(false);
        return;
      }

      // Redireciona pro hosted checkout do Asaas (cadastro do cartão).
      window.location.href = body.checkoutUrl;
    } catch (err) {
      console.error(err);
      setError('Erro de rede. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[1.05fr_1fr] gap-8 items-start">
      {/* Lado esquerdo — proposta de valor */}
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-4 py-1.5 text-xs font-medium text-brand">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {trialDays} dias grátis · sem cobrança agora
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.15]">
          <span className="text-foreground">Cadastre seu cartão e </span>
          <span className="text-brand-gradient">libere o PROGPT.</span>
        </h1>
        <p className="text-base text-muted-foreground max-w-md">
          Para começar seus {trialDays} dias grátis, precisamos de um cartão
          cadastrado — <strong className="text-foreground">nada é cobrado agora</strong>.
          A primeira cobrança de {priceLabel}/mês só acontece após o período, e
          você pode cancelar antes sem pagar nada.
        </p>
        <ul className="space-y-3">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand/15 text-brand flex-shrink-0">
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
              <span className="text-foreground/80">{p}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Lado direito — formulário */}
      <div className="rounded-3xl border border-border bg-card p-6 md:p-7 shadow-[0_24px_60px_-22px_rgba(14,141,225,0.4)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
          <CreditCard className="h-4 w-4 text-brand" aria-hidden="true" />
          Seus dados
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Usamos no cadastro seguro do Asaas. O CPF não fica salvo no PROGPT.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="trial-name" className={LABEL}>
              Nome completo
            </label>
            <input
              id="trial-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="trial-cpf" className={LABEL}>
              CPF
            </label>
            <input
              id="trial-cpf"
              type="text"
              required
              value={cpfInput}
              onChange={(e) => setCpfInput(maskCPF(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              className={INPUT}
            />
            {cpfInput.length > 0 && !cpfOk && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                CPF inválido — verifique os dígitos.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="trial-phone" className={LABEL}>
              Telefone
            </label>
            <input
              id="trial-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="trial-req" className={LABEL}>
              Exigência profissional
            </label>
            <input
              id="trial-req"
              type="text"
              value={professionalRequirement}
              onChange={(e) => setProfessionalRequirement(e.target.value)}
              placeholder="Ex.: Comprador, Gerente de Suprimentos…"
              className={INPUT}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient text-black hover:brightness-110 brand-glow disabled:opacity-50 disabled:cursor-not-allowed h-11 text-sm font-semibold transition-all active:scale-[0.98]"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Redirecionando…
              </>
            ) : (
              <>
                Cadastrar cartão e começar
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            )}
          </button>
          <p className="text-[11px] text-muted-foreground text-center pt-2 border-t border-border">
            Você será levado ao ambiente seguro do Asaas pra inserir o cartão.
            Nenhum valor é cobrado durante os {trialDays} dias.
          </p>
        </form>
      </div>
    </div>
  );
}
