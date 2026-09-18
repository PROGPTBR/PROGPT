"use client";
import { useState } from "react";
import Image from "next/image";
import type { SignupForm } from "./types";
import { INPUT_CLASS, LABEL_CLASS } from "./constants";
import { TurnstileWidget } from "./TurnstileWidget";
import { SeatChargeSummary } from "@/components/billing/SeatSelector";

type StepPaymentProps = {
  form: SignupForm;
  setForm: React.Dispatch<React.SetStateAction<SignupForm>>;
  /** Preço unitário do plano e dias de trial — usados pra mostrar a conta
   *  fechada (quantidade × unitário) na hora de digitar o cartão. */
  planPrice: number;
  trialDays: number;
};

function detectCardBrand(number: string): string {
  const card = number.replace(/\D/g, "");

  if (/^4/.test(card)) return "visa";

  if (/^(5[1-5]|2[2-7])/.test(card))
    return "mastercard";

  if (/^3[47]/.test(card))
    return "amex";

  if (/^3(0[0-5]|[68])/.test(card))
    return "diners";

  if (/^6(?:011|5)/.test(card))
    return "discover";

  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|5090|6277|6362|6363|650|6516|6550)/.test(card))
    return "elo";

  if (/^(606282|3841)/.test(card))
    return "hipercard";

  return "";
}

function getCardBrandLogo(brand: string) {
  switch (brand) {
    case "visa":
      return "/card-brands/visa.svg";

    case "mastercard":
      return "/card-brands/mastercard.svg";

    case "amex":
      return "/card-brands/amex.svg";

    case "elo":
      return "/card-brands/elo.svg";

    case "hipercard":
      return "/card-brands/hipercard.svg";

    case "discover":
      return "/card-brands/discover.svg";

    case "diners":
      return "/card-brands/diners.svg";

    default:
      return "/card-brands/generic.svg";
  }
}

export default function StepPayment({
  form,
  setForm,
  planPrice,
  trialDays,
}: StepPaymentProps) {
  const cardBrand = detectCardBrand(form.cardNumber);
  // Verificação anti-bot fica no ÚLTIMO passo, não no primeiro (sub-projeto
  // 56.1): o token do Turnstile expira em ~5 min e é de uso único. No passo 1
  // ele ficava pronto cedo demais e, pra formulários que levam mais tempo
  // (perfil + revisão do plano + dados do cartão), chegava expirado na hora
  // do submit real — "Falha na verificação de segurança" sem nenhuma relação
  // com o cartão em si (achado 2026-09-14, print do cliente com Mastercard).
  const [turnstileError, setTurnstileError] = useState<string | null>(null);

  return (


<div className="space-y-8">

     
<h3 className="text-lg rounded-xl bg-brand/5 p-5 ">🔒 Pagamento seguro</h3>
<p>Seus dados são protegidos por criptografia.
Você não será cobrado hoje.
A primeira cobrança ocorrerá somente após {trialDays === 1 ? "1 dia" : `${trialDays} dias`}.</p>

{/* O cliente precisa ver AQUI, com o cartão na mão, exatamente quanto e
    por quantos usuários será cobrado. */}
<SeatChargeSummary
  seats={form.seats}
  unitPrice={planPrice}
  trialDays={trialDays}
/>

<div className="space-y-5">

  {/* Número do cartão */}
  <div>

    <label className={LABEL_CLASS}>
      Número do cartão
    </label>

    <div className="relative">

  <input
    className={`${INPUT_CLASS} pr-16`}
    value={form.cardNumber}
    placeholder="0000 0000 0000 0000"
    maxLength={19}

    onChange={(e) => {
      const value = e.target.value
        .replace(/\D/g, "")
        .slice(0, 16)
        .replace(/(\d{4})(?=\d)/g, "$1 ");

      setForm((prev) => ({
        ...prev,
        cardNumber: value,
      }));
    }}
  />

  <div className="absolute right-4 top-1/2 -translate-y-1/2">
  <Image
    src={getCardBrandLogo(cardBrand)}
    alt={cardBrand}
    width={42}
    height={26}
    className="object-contain"
  />
</div>

</div>

</div>

  <div>
    <label className={LABEL_CLASS}>Nome impresso no cartão</label>

    <input
      value={form.cardHolder}
   onChange={(e) =>
  setForm((prev) => ({
    ...prev,
    cardHolder: e.target.value.toUpperCase(),
  }))
}
      className={INPUT_CLASS}
    />
  </div>

  <div className="grid grid-cols-2 gap-4">

    <div>

      <label className={LABEL_CLASS}>Validade</label>

      <input
        value={form.cardExpiry}
      onChange={(e) => {
  let value = e.target.value.replace(/\D/g, "").slice(0, 4);

  if (value.length >= 2) {
    let month = parseInt(value.substring(0, 2));

    if (month < 1) month = 1;
    if (month > 12) month = 12;

    value =
      month.toString().padStart(2, "0") +
      value.substring(2);
  }

  if (value.length > 2) {
    value = value.replace(/^(\d{2})(\d+)/, "$1/$2");
  }

  setForm((prev) => ({
    ...prev,
    cardExpiry: value,
  }));
}}
        className={INPUT_CLASS}
       placeholder="MM/AA"
maxLength={5}
inputMode="numeric"
      />

    </div>

    <div>

      <label className={LABEL_CLASS}>CVV</label>

      <input
        value={form.cardCvv}
        onChange={(e) => {
  const value = e.target.value
    .replace(/\D/g, "")
    .slice(0, 4);

  setForm((prev) => ({
    ...prev,
    cardCvv: value,
  }));
}}
        className={INPUT_CLASS}
        placeholder={cardBrand === "amex" ? "1234" : "123"}
maxLength={4}
inputMode="numeric"
      />

    </div>


  </div>

  <div>
    <TurnstileWidget
      onVerify={(token) => {
        setForm((prev) => ({
          ...prev,
          turnstileToken: token,
        }));
        setTurnstileError(
          token ? null : "Aguarde a verificação anti-bot terminar de carregar.",
        );
      }}
    />

    {turnstileError && (
      <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
        {turnstileError}
      </div>
    )}
  </div>

</div>


</div>
  );
}