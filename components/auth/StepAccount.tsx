"use client";

import { useState } from "react";
import { INPUT_CLASS, LABEL_CLASS } from "./constants";
import type { SignupForm } from "./types";
import { TurnstileWidget } from "./TurnstileWidget";


type StepAccountProps = {
  form: SignupForm;
  setForm: React.Dispatch<React.SetStateAction<SignupForm>>;
};

export default function StepAccount({

  form,
  setForm,
}: StepAccountProps) {

  
const [errorMessage, setErrorMessage] = useState<string | null>(null);

 return (
  <div className="space-y-6">

    <div>
      <label
        htmlFor="signup-email"
        className={LABEL_CLASS}
      >
        Email
      </label>

      <input
        id="signup-email"
        type="email"
        autoComplete="email"
       value={form.email}
       onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value, })) }
        className={INPUT_CLASS}
        placeholder="Digite seu e-mail"
      />
    </div>

    <div>
      <label
        htmlFor="signup-password"
        className={LABEL_CLASS}
      >
        Senha
      </label>

      <input
        id="signup-password"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value, })) }
        className={INPUT_CLASS}
      />
 

    </div>

    <div>
      <label
        htmlFor="signup-confirm-password"
        className={LABEL_CLASS}
      >
        Confirmar senha
      </label>

      <input
        id="signup-confirm-password"
        type="password"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value, })) }
        className={INPUT_CLASS}
      />
      
    </div>
  <div className="space-y-6">
    <TurnstileWidget
        onVerify={(token) => {
          setForm((prev) => ({
            ...prev,
            turnstileToken: token,
          }));

          if (!token) {
            setErrorMessage(
              "Aguarde a verificação anti-bot terminar de carregar."
            );
          } else {
            setErrorMessage(null);
          }
        }}
      />

         {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      )}
      </div>
  </div>
);

}