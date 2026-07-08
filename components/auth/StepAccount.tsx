"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { INPUT_CLASS, LABEL_CLASS } from "./constants";
import type { SignupForm } from "./types";
import { TurnstileWidget } from "./TurnstileWidget";


type StepAccountProps = {
  form: SignupForm;
  setForm: React.Dispatch<React.SetStateAction<SignupForm>>;
};

const PW_TOGGLE_CLASS =
  "absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors";

export default function StepAccount({

  form,
  setForm,
}: StepAccountProps) {


const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [showPw, setShowPw] = useState(false);
const [showConfirmPw, setShowConfirmPw] = useState(false);

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

      <div className="relative">
        <input
          id="signup-password"
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value, })) }
          className={`${INPUT_CLASS} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
          title={showPw ? "Ocultar senha" : "Mostrar senha"}
          className={PW_TOGGLE_CLASS}
        >
          {showPw ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

    </div>

    <div>
      <label
        htmlFor="signup-confirm-password"
        className={LABEL_CLASS}
      >
        Confirmar senha
      </label>

      <div className="relative">
        <input
          id="signup-confirm-password"
          type={showConfirmPw ? "text" : "password"}
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value, })) }
          className={`${INPUT_CLASS} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShowConfirmPw((v) => !v)}
          aria-label={showConfirmPw ? "Ocultar senha" : "Mostrar senha"}
          title={showConfirmPw ? "Ocultar senha" : "Mostrar senha"}
          className={PW_TOGGLE_CLASS}
        >
          {showConfirmPw ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

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