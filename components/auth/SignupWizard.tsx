"use client";

import { useRouter} from "next/navigation";

import { useState } from 'react';
import type { SignupForm } from "./types";
import NavigationButtons from "./NavigationButtons";
import { ERROR_CLASS } from "./constants";
import SignupStepper from './SignupStepper';
import StepAccount from './StepAccount';
import StepProfile from './StepProfile';
import StepPayment from './StepPayment';
import { isValidCpf } from "@/lib/validators/cpf";
import StepPlan from "./StepPlan";



export function SignupWizard() {

const router = useRouter();

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

  turnstileToken: null,
});

  const [error, setError] = useState("");

  const [signupSuccess, setSignupSuccess] = useState(false);

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

  if (!form.turnstileToken) {
    return "Confirme que você não é um robô.";
  }

  return "";
}
function validateStep2() {
  if (!form.fullName.trim()) {
    return "Informe seu nome completo.";
  }

  if (!form.cpf.trim()) {
    return "Informe seu CPF.";
  }

  const cpf = form.cpf.replace(/\D/g, "");

  if (!isValidCpf(cpf)) {
    return "Informe um CPF válido.";
  }

  if (!form.phone.trim()) {
    return "Informe seu telefone.";
  }

  const phone = form.phone.replace(/\D/g, "");

  if (phone.length !== 11) {
    return "Informe um telefone válido.";
  }

  return "";
}

const nextStep = async () => {
 console.log("NEXT STEP", new Date().toISOString());
 
  if (loading) return;
  setError("");

  if (step === 1) {
    const validation = validateStep1();

    if (validation) {
      setError(validation);
      return;
    }
  }

  if (step === 2) {
    const validation = validateStep2();

    if (validation) {
      setError(validation);
      return;
    }
  }

  if (step < 4) {
    setStep((s) => s + 1);
    return;
  }

  setLoading(true);

  try {
    // continua o código...

 const response = await fetch("/api/signup", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(form),
});

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      alert(data.error);
      return;
    }

    setSignupSuccess(true);

 } catch (err) {
  console.error(err);

  alert("Não foi possível concluir o cadastro. Tente novamente.");
} finally {

    setLoading(false);

  }

};

    const prevStep = () => {
        setStep((s) => Math.max(s - 1, 1));
    };

if (signupSuccess) {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
      <div className="mb-6 text-5xl">🎉</div>

     <h2 className="text-2xl font-bold">
  Cadastro realizado com sucesso!
</h2>

<p className="mt-4 text-muted-foreground">
  Sua conta foi criada com sucesso.
</p>

<p className="mt-2 text-muted-foreground">
  Utilize o e-mail <strong>{form.email}</strong> para acessar a plataforma.
</p>

<p className="mt-4 text-sm text-muted-foreground">
  Clique no botão abaixo para ir para a tela de login.
</p>
      <button
        onClick={() => router.push(`/login?email=${encodeURIComponent(form.email)}`)}
        className="mt-8 w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:opacity-90"
      >
        Ir para o Login
      </button>
    </div>
  );
}


    return (

        <div className="w-full max-w-xl mx-auto">

            <SignupStepper step={step} />

            {step === 1 && <StepAccount form={form} setForm={setForm} />}
            {error && ( <div className={`${ERROR_CLASS} mt-4`}>  {error} </div> )}
            {step === 2 && ( <StepProfile form={form} setForm={setForm} /> )}
            {step === 3 && ( <StepPlan /> )}
            {step === 4 && ( <StepPayment form={form}  setForm={setForm} /> )}

           <NavigationButtons
  step={step}
  loading={loading}
  onNext={nextStep}
  onBack={prevStep}
/>

        </div>

    );

}