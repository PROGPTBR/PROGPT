'use client';

import { Minus, Plus, Users } from 'lucide-react';

import {
  MIN_SEATS,
  MAX_SEATS,
  parseSeats,
  seatsTotal,
  formatBRL,
} from '@/lib/billing/seats';

// Seletor de quantidade de usuários (assinatura por seat), compartilhado
// pelos três fluxos de contratação: /signup, /planos (checkout hospedado) e
// /account/billing/checkout. Um componente só pra que o cliente veja a MESMA
// conta em qualquer caminho — e pra que o número enviado ao Asaas venha
// sempre do mesmo lugar (lib/billing/seats).

type SeatSelectorProps = {
  seats: number;
  onChange: (seats: number) => void;
  unitPrice: number;
  disabled?: boolean;
  /** Texto auxiliar abaixo do seletor. */
  hint?: string;
};

export function SeatSelector({
  seats,
  onChange,
  unitPrice,
  disabled = false,
  hint,
}: SeatSelectorProps) {
  const value = parseSeats(seats);
  const total = seatsTotal(unitPrice, value);

  function step(delta: number) {
    onChange(parseSeats(value + delta));
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users
          className="h-4 w-4 text-brand"
          aria-hidden="true"
        />

        <span className="text-sm font-medium text-foreground">
          Quantos usuários vão usar?
        </span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Remover um usuário"
            disabled={disabled || value <= MIN_SEATS}
            onClick={() => step(-1)}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-background text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand/50 transition-colors"
          >
            <Minus
              className="h-4 w-4"
              aria-hidden="true"
            />
          </button>

          <input
            type="number"
            inputMode="numeric"
            aria-label="Quantidade de usuários"
            min={MIN_SEATS}
            max={MAX_SEATS}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(parseSeats(e.target.value))}
            className="h-9 w-16 rounded-lg border border-input bg-background text-center text-sm font-semibold text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />

          <button
            type="button"
            aria-label="Adicionar um usuário"
            disabled={disabled || value >= MAX_SEATS}
            onClick={() => step(1)}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-background text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand/50 transition-colors"
          >
            <Plus
              className="h-4 w-4"
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="text-right">
          <div className="text-lg font-bold text-foreground leading-none">
            {formatBRL(total)}
            <span className="text-xs font-normal text-muted-foreground">
              /mês
            </span>
          </div>

          <div className="text-[11px] text-muted-foreground mt-1">
            {formatBRL(unitPrice)} por usuário
          </div>
        </div>
      </div>

      {value > 1 && (
        <p className="text-xs text-muted-foreground">
          {value} usuários × {formatBRL(unitPrice)} ={' '}
          <strong className="text-foreground">{formatBRL(total)}</strong> por
          mês.
        </p>
      )}

      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Resumo do que será cobrado — pensado pra ficar JUNTO do formulário de
 *  cartão, porque o cliente precisa ver a conta fechada na hora de pagar. */
export function SeatChargeSummary({
  seats,
  unitPrice,
  trialDays,
}: {
  seats: number;
  unitPrice: number;
  trialDays?: number;
}) {
  const value = parseSeats(seats);
  const total = seatsTotal(unitPrice, value);

  return (
    <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 space-y-1.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Usuários contratados</span>
        <strong className="text-foreground">{value}</strong>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Valor por usuário</span>
        <strong className="text-foreground">{formatBRL(unitPrice)}/mês</strong>
      </div>

      <div className="flex items-center justify-between border-t border-brand/20 pt-1.5">
        <span className="font-medium text-foreground">Total mensal</span>
        <strong className="text-base text-foreground">
          {formatBRL(total)}/mês
        </strong>
      </div>

      {typeof trialDays === 'number' && trialDays > 0 && (
        <p className="text-xs text-muted-foreground pt-1">
          Nada é cobrado hoje. A primeira cobrança de {formatBRL(total)} ocorre
          após {trialDays === 1 ? '1 dia' : `${trialDays} dias`}.
        </p>
      )}
    </div>
  );
}
