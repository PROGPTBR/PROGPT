"use client";
import { CheckCircle2 } from "lucide-react";



import type { SignupForm } from "./types";
import NavigationButtons from "./NavigationButtons";
import { ERROR_CLASS } from "./constants";
import SignupStepper from './SignupStepper';
import StepAccount from './StepAccount';
import StepProfile from './StepProfile';
import StepPayment from './StepPayment';
import { isValidCpf } from "@/lib/validators/cpf";
import { isValidCnpj } from "@/lib/validators/cnpj";
import StepPlan from "./StepPlan";

import { useRef, useState } from 'react';

export function SignupWizard() {
  
  
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

  turnstileToken: null,
  personType: "pf",
});

  const [error, setError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);

  const showError = (message: string) => {
  setError(message);

  setTimeout(() => {
    errorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, 50);
};

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
    return "Informe um CEP válido.";
  }

  if (!form.addressNumber.trim()) {
    return "Informe o número do endereço.";
  }

  if (!form.district.trim()) {
  return "Informe um CEP válido.";
}

if (!form.city.trim()) {
  return "Informe um CEP válido.";
}

if (!form.state.trim()) {
  return "Informe um CEP válido.";
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
    showError(validation);
    return;
  }
}

if (step === 2) {
  const validation = validateStep2();

  if (validation) {
    showError(validation);
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


    return (

        <div className="w-full max-w-xl mx-auto">

            <SignupStepper step={step} />

            {step === 1 && <StepAccount form={form} setForm={setForm} />}
            {error && ( <div ref={errorRef} className={`${ERROR_CLASS} mt-4`}>  {error} </div> )}
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