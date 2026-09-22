"use client";

import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import type { SignupForm } from "./types";

import NavigationButtons from "./NavigationButtons";
import { ERROR_CLASS } from "./constants";
import SignupStepper from "./SignupStepper";
import StepAccount from "./StepAccount";
import StepProfile from "./StepProfile";
import StepPayment from "./StepPayment";
import StepPlan from "./StepPlan";

import { isValidCpf } from "@/lib/validators/cpf";
import { isValidCnpj } from "@/lib/validators/cnpj";
import { parseSeats } from "@/lib/billing/seats";

type SignupWizardProps = {
  planPrice: number;
  trialDays: number;

  /**
   * Quantidade de usuários pré-selecionada via link:
   * /signup?usuarios=3
   *
   * Permite mandar o link já configurado
   * para quem vai contratar.
   */
  initialSeats?: number;
};

/* =========================================================
   MENSAGENS AMIGÁVEIS DOS ERROS DA API
========================================================= */

function friendlySignupError(error?: string) {
  switch (error) {
    case "invalid_cpf":
      return "CPF inválido. Verifique o número informado e tente novamente.";

    case "invalid_cnpj":
      return "CNPJ inválido. Verifique o número informado e tente novamente.";

    case "invalid_document":
      return "CPF ou CNPJ inválido. Verifique o número informado.";

    case "invalid_email":
      return "Informe um endereço de e-mail válido.";

    case "email_already_registered":
    case "email_already_exists":
    case "user_already_exists":
      return "Este e-mail já possui uma conta cadastrada.";

    case "weak_password":
      return "A senha informada não atende aos requisitos mínimos de segurança.";

    case "invalid_phone":
      return "Telefone inválido. Verifique o número informado.";

    case "invalid_postal_code":
      return "CEP inválido. Verifique o número informado.";

    case "invalid_card":
    case "invalid_credit_card":
      return "Os dados do cartão são inválidos. Verifique as informações e tente novamente.";

    case "card_declined":
    case "payment_declined":
      return "O cartão não foi autorizado. Verifique os dados ou tente outro cartão.";

    case "invalid_customer_data":
      return "Não foi possível validar seus dados. Verifique as informações e tente novamente.";

    case "billing_provider_error":
      return "Não foi possível processar o pagamento agora. Tente novamente em alguns instantes.";

    case "captcha_invalid":
    case "invalid_turnstile":
    case "turnstile_failed":
      return "Não foi possível validar a verificação de segurança. Tente novamente.";

    case "rate_limited":
      return "Muitas tentativas foram realizadas. Aguarde alguns instantes e tente novamente.";

    case "invalid_body":
      return "Alguns dados estão inválidos. Verifique os campos e tente novamente.";

    case "signup_failed":
      return "Não foi possível criar sua conta. Verifique os dados e tente novamente.";

    default:
      return "Não foi possível concluir o cadastro. Tente novamente.";
  }
}

export function SignupWizard({
  planPrice,
  trialDays,
  initialSeats = 1,
}: SignupWizardProps) {
  const errorRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState<SignupForm>({
    email: "",
    password: "",
    confirmPassword: "",

    fullName: "",
    cpf: "",
    phone: "",

    companyName: "",
    position: "",

    plan: "",

    cardNumber: "",
    cardHolder: "",
    cardExpiry: "",
    cardCvv: "",

    postalCode: "",
    addressNumber: "",
    addressComplement: "",
    street: "",
    district: "",
    city: "",
    state: "",

    seats: parseSeats(initialSeats),
    seatEmails: [],

    turnstileToken: null,

    personType: "pf",
  });

  const [error, setError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);

  /* =========================================================
     MOSTRA ERRO
  ========================================================= */

  const showError = (message: string) => {
    setError(message);

    setTimeout(() => {
      errorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  };

  /* =========================================================
     VALIDAÇÃO — ETAPA 1
  ========================================================= */

  function validateStep1() {
    if (!form.email.trim()) {
      return "Informe seu e-mail.";
    }

    if (!form.password.trim()) {
      return "Informe uma senha.";
    }

    if (form.password.length < 8) {
      return "A senha deve possuir pelo menos 8 caracteres.";
    }

    if (form.password !== form.confirmPassword) {
      return "As senhas não coincidem.";
    }

    return "";
  }

  /* =========================================================
     VALIDAÇÃO — ETAPA 2
  ========================================================= */

  function validateStep2() {
    if (!form.fullName.trim()) {
      return "Informe seu nome completo.";
    }

    if (!form.cpf.trim()) {
      return form.personType === "pj"
        ? "Informe seu CNPJ."
        : "Informe seu CPF.";
    }

    const documento = form.cpf.replace(/\D/g, "");

    if (form.personType === "pf") {
      if (!isValidCpf(documento)) {
        return "Informe um CPF válido.";
      }
    } else {
      if (!isValidCnpj(documento)) {
        return "Informe um CNPJ válido.";
      }
    }

    if (!form.phone.trim()) {
      return "Informe seu telefone.";
    }

    const phone = form.phone.replace(/\D/g, "");

    if (phone.length !== 11) {
      return "Informe um telefone válido.";
    }

    if (!form.postalCode.trim()) {
      return "Informe o CEP.";
    }

    if (!form.street.trim()) {
      return "Informe a rua/logradouro.";
    }

    if (!form.addressNumber.trim()) {
      return "Informe o número do endereço.";
    }

    if (!form.district.trim()) {
      return "Informe o bairro.";
    }

    if (!form.city.trim()) {
      return "Informe a cidade.";
    }

    if (!form.state.trim()) {
      return "Informe o estado (UF).";
    }

    return "";
  }

  /* =========================================================
     VALIDAÇÃO — ETAPA 4
  ========================================================= */

  function validateStep4() {
    if (!form.turnstileToken) {
      return "Confirme que você não é um robô.";
    }

    const cardDigits = form.cardNumber.replace(/\D/g, "");

    if (cardDigits.length < 13) {
      return "Informe um número de cartão válido.";
    }

    if (!form.cardHolder.trim()) {
      return "Informe o nome impresso no cartão.";
    }

    if (!/^\d{2}\/\d{2}$/.test(form.cardExpiry)) {
      return "Informe a validade do cartão (MM/AA).";
    }

    const expMonth = Number(
      form.cardExpiry.slice(0, 2),
    );

    const expYear = Number(
      form.cardExpiry.slice(3, 5),
    );

    if (expMonth < 1 || expMonth > 12) {
      return "Informe um mês de validade válido.";
    }

    const now = new Date();

    const currentYear =
      now.getFullYear() % 100;

    const currentMonth =
      now.getMonth() + 1;

    if (
      expYear < currentYear ||
      (
        expYear === currentYear &&
        expMonth < currentMonth
      )
    ) {
      return "Cartão vencido — confira a validade informada.";
    }

    const cvv =
      form.cardCvv.replace(/\D/g, "");

    if (cvv.length < 3 || cvv.length > 4) {
      return "Informe o CVV do cartão (3 dígitos, ou 4 para Amex).";
    }

    return "";
  }

  /* =========================================================
     AVANÇAR / FINALIZAR CADASTRO
  ========================================================= */

  const nextStep = async () => {
    console.log(
      "NEXT STEP",
      new Date().toISOString(),
    );

    if (loading) return;

    setError("");

    /* -------------------------
       ETAPA 1
    ------------------------- */

if (step === 1) {
  const validation = validateStep1();

  if (validation) {
    showError(validation);
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(
      "/api/auth/check-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email.trim(),
        }),
      },
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      showError(
        data?.message ||
          "Não foi possível verificar o e-mail agora. Tente novamente.",
      );

      return;
    }

    if (data.exists) {
      showError(
        "Este e-mail já possui uma conta cadastrada.",
      );

      return;
    }
  } catch (err) {
    console.error(
      "[SignupWizard] check-email failed:",
      err,
    );

    showError(
      "Não foi possível verificar o e-mail agora. Tente novamente.",
    );

    return;
  } finally {
    setLoading(false);
  }
}

    /* -------------------------
       ETAPA 2
    ------------------------- */

    if (step === 2) {
      const validation =
        validateStep2();

      if (validation) {
        showError(validation);
        return;
      }
    }

    /* -------------------------
       ETAPA 4
    ------------------------- */

    if (step === 4) {
      const validation =
        validateStep4();

      if (validation) {
        showError(validation);
        return;
      }
    }

    /* -------------------------
       AVANÇA ETAPAS
    ------------------------- */

    if (step < 4) {
      setStep((s) => s + 1);
      return;
    }

    /* =========================================================
       ENVIA CADASTRO
    ========================================================= */

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/signup",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(form),
          },
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      /* =====================================================
         TRATAMENTO DE ERROS DA API
      ===================================================== */

      if (!response.ok) {
        const message =
          typeof data?.message === "string" &&
          data.message.trim()
            ? data.message
            : friendlySignupError(
                data?.error,
              );

        showError(message);

        return;
      }

      setSignupSuccess(true);
    } catch (err) {
      console.error(
        "[SignupWizard] signup failed:",
        err,
      );

      showError(
        "Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     VOLTAR
  ========================================================= */

  const prevStep = () => {
    setError("");

    setStep((s) =>
      Math.max(s - 1, 1),
    );
  };

  /* =========================================================
     SUCESSO
  ========================================================= */

  if (signupSuccess) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-2 flex justify-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        </div>

        <h2 className="text-2xl font-bold text-white">
          Cadastro realizado com sucesso!
        </h2>

        <p className="mt-4 text-white">
          Enviamos um e-mail de confirmação.
        </p>

        <p className="mt-4 text-sm text-muted-foreground">
          Clique no botão do e-mail para ativar sua conta.
        </p>
      </div>
    );
  }

  /* =========================================================
     WIZARD
  ========================================================= */

  return (
    <div className="mx-auto w-full max-w-xl">
      <SignupStepper step={step} />

      {/* =====================================================
          ETAPA 1
      ===================================================== */}

      {step === 1 && (
        <StepAccount
          form={form}
          setForm={setForm}
        />
      )}

      {/* =====================================================
          ERRO
      ===================================================== */}

      {error && (
        <div
          ref={errorRef}
          className={`${ERROR_CLASS} mt-4`}
        >
          {error}
        </div>
      )}

      {/* =====================================================
          ETAPA 2
      ===================================================== */}

      {step === 2 && (
        <StepProfile
          form={form}
          setForm={setForm}
        />
      )}

      {/* =====================================================
          ETAPA 3
      ===================================================== */}

      {step === 3 && (
        <StepPlan
          planPrice={planPrice}
          trialDays={trialDays}
          seats={form.seats}
          onSeatsChange={(seats) =>
            setForm((prev) => ({
              ...prev,
              seats,
            }))
          }
          seatEmails={
            form.seatEmails
          }
          onSeatEmailsChange={(
            seatEmails,
          ) =>
            setForm((prev) => ({
              ...prev,
              seatEmails,
            }))
          }
        />
      )}

      {/* =====================================================
          ETAPA 4
      ===================================================== */}

      {step === 4 && (
        <StepPayment
          form={form}
          setForm={setForm}
          planPrice={planPrice}
          trialDays={trialDays}
        />
      )}

      {/* =====================================================
          NAVEGAÇÃO
      ===================================================== */}

      <NavigationButtons
        step={step}
        loading={loading}
        onNext={nextStep}
        onBack={prevStep}
      />
    </div>
  );
}