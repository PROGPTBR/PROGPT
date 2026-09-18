"use client";

import { ShieldCheck, CheckCircle2 } from "lucide-react";

import { SeatSelector } from "@/components/billing/SeatSelector";
import {
  parseSeats,
  seatsTotal,
  formatBRL,
} from "@/lib/billing/seats";
import { INPUT_CLASS } from "./constants";

type StepPlanProps = {
  planPrice: number;
  trialDays: number;
  /** Assinatura por usuário (2026-09-17): a empresa escolhe quantos acessos
   *  quer e o valor é multiplicado. */
  seats: number;
  onSeatsChange: (seats: number) => void;
  seatEmails: string[];
  onSeatEmailsChange: (emails: string[]) => void;
};

export default function StepPlan({
  planPrice,
  trialDays,
  seats,
  onSeatsChange,
  seatEmails,
  onSeatEmailsChange,
}: StepPlanProps) {
  const trialLabel = trialDays === 1 ? "1 dia" : `${trialDays} dias`;
  const ordinalDay = `${trialDays}º dia`;

  const quantity = parseSeats(seats);
  const total = seatsTotal(planPrice, quantity);

  // Um campo por usuário ADICIONAL — o titular do cadastro já ocupa 1 acesso.
  const extraSeats = Math.max(0, quantity - 1);

  function setEmailAt(index: number, value: string) {
    const next = [...seatEmails];

    while (next.length < extraSeats) {
      next.push("");
    }

    next[index] = value;

    onSeatEmailsChange(next.slice(0, extraSeats));
  }

  return (
    <div className="space-y-8">
      {/* Benefícios */}
      <div className="rounded-xl bg-brand/5 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-brand" />
          <span>Acesso imediato.</span>
        </div>

        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-brand" />
          <span>Cancele quando quiser.</span>
        </div>

        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-brand" />
          <span>Cobrança somente após {trialLabel}.</span>
        </div>
      </div>

      {/* Quantidade de usuários */}
      <SeatSelector
        seats={quantity}
        onChange={onSeatsChange}
        unitPrice={planPrice}
        hint="Contratando para uma equipe? Cada pessoa tem o próprio login, histórico e assistentes."
      />

      {/* E-mails dos usuários adicionais — OPCIONAL por decisão explícita:
          nada aqui pode travar o cadastro. Se o cliente deixar em branco, a
          2B Supply combina os acessos depois. */}
      {extraSeats > 0 && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              E-mails dos outros {extraSeats === 1 ? "usuário" : `${extraSeats} usuários`}{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              Pode deixar em branco e informar depois — não impede a
              contratação. Sua conta já é o 1º acesso.
            </p>
          </div>

          {Array.from({ length: extraSeats }).map((_, i) => (
            <input
              key={i}
              type="email"
              className={INPUT_CLASS}
              placeholder={`E-mail do usuário ${i + 2}`}
              value={seatEmails[i] ?? ""}
              onChange={(e) => setEmailAt(i, e.target.value)}
            />
          ))}
        </div>
      )}

      {/* Valores */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Hoje</span>
          <strong>R$ 0,00</strong>
        </div>

        <div className="flex items-center justify-between">
          <span>Primeira cobrança</span>
          <strong>Após o {ordinalDay}</strong>
        </div>

        {quantity > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {quantity} usuários × {formatBRL(planPrice)}
            </span>
            <span>{formatBRL(total)}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span>Depois</span>
          <strong>{formatBRL(total)}/mês</strong>
        </div>

        <div className="text-left text-sm text-muted-foreground leading-relaxed">
          Ao clicar em <strong>Continuar</strong>, você será direcionado para a
          etapa segura de cadastro do cartão. Nenhuma cobrança será realizada
          durante o período de teste gratuito.
        </div>
      </div>
    </div>
  );
}
