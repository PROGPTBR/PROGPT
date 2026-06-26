"use client";

import type { SignupForm } from "./types";
import { INPUT_CLASS, LABEL_CLASS } from "./constants";

type StepPaymentProps = {
  form: SignupForm;
  setForm: React.Dispatch<React.SetStateAction<SignupForm>>;
};

export default function StepPayment({
  form,
  setForm,
}: StepPaymentProps) {

  return (


<div className="space-y-8">

     
<h3 className="text-lg rounded-xl bg-brand/5 p-5 ">🔒 Pagamento seguro</h3>
<p>Seus dados são protegidos por criptografia.
Você não será cobrado hoje.
A primeira cobrança ocorrerá somente após 3 dias.</p>

{/* Dados do cartão */}
<div className="space-y-5">

  <div>
    <label className={LABEL_CLASS}>Número do cartão</label>

    <input
      value={form.cardNumber}
      onChange={(e)=>
        setForm(prev=>({
          ...prev,
          cardNumber:e.target.value
        }))
      }
      className={INPUT_CLASS}
      placeholder="0000 0000 0000 0000"
    />
  </div>

  <div>
    <label className={LABEL_CLASS}>Nome impresso no cartão</label>

    <input
      value={form.cardHolder}
      onChange={(e)=>
        setForm(prev=>({
          ...prev,
          cardHolder:e.target.value
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
        onChange={(e)=>
          setForm(prev=>({
            ...prev,
            cardExpiry:e.target.value
          }))
        }
        className={INPUT_CLASS}
        placeholder="12/28"
      />

    </div>

    <div>

      <label className={LABEL_CLASS}>CVV</label>

      <input
        value={form.cardCvv}
        onChange={(e)=>
          setForm(prev=>({
            ...prev,
            cardCvv:e.target.value
          }))
        }
        className={INPUT_CLASS}
        placeholder="123"
      />

    </div>

    <div className="space-y-3 pt-6">

  <label className={LABEL_CLASS}>
    Verificação de segurança
  </label>


</div>

  </div>

</div>


</div>
  );
}