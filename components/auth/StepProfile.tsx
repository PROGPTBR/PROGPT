import { INPUT_CLASS, LABEL_CLASS } from "./constants";
import { User, Building2 } from "lucide-react";
import type { SignupForm } from "./types";
import { maskCpf, maskCnpj, maskPhone, formatCep } from "./masks";
import { buscarCep } from "./viaCep";
import { isValidCpf } from "@/lib/validators/cpf";
import { isValidCnpj } from "@/lib/validators/cnpj";

type StepProfileProps = {
  form: SignupForm;
  setForm: React.Dispatch<React.SetStateAction<SignupForm>>;
};

export default function StepProfile({
  form,
  setForm,
}: StepProfileProps) {
  // Feedback inline de documento: só mostra o erro quando o usuário já digitou
  // todos os dígitos (11 CPF / 14 CNPJ) e o checksum falha — evita "piscar"
  // inválido no meio da digitação. O bloqueio de submit fica no validateStep2.
  const docDigits = form.cpf.replace(/\D/g, "");
  const isPj = form.personType === "pj";
  const docComplete = isPj ? docDigits.length === 14 : docDigits.length === 11;
  const docInvalid =
    docComplete && !(isPj ? isValidCnpj(docDigits) : isValidCpf(docDigits));

  return (

    <div className="space-y-6 mt-4">
        <div className="rounded-xl bg-brand/5 p-3 space-y-2">
<h3 className="font-semibold text-md">
Dados cadastrais
</h3>
</div>

<div>
  <label className={LABEL_CLASS}>
    Tipo de cadastro
  </label>

  <div className="mt-2 grid grid-cols-2 rounded-xl border border-slate-700 bg-slate-900 p-1">

    <button
      type="button"
      onClick={() =>
        setForm((prev) => ({
          ...prev,
          personType: "pf",
        }))
      }
      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 transition-all duration-200 ${
        form.personType === "pf"
          ? "bg-brand text-white shadow"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <User className="h-4 w-4" />
      <span>Pessoa Física</span>
    </button>

    <button
      type="button"
      onClick={() =>
        setForm((prev) => ({
          ...prev,
          personType: "pj",
        }))
      }
      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 transition-all duration-200 ${
        form.personType === "pj"
          ? "bg-brand text-white shadow"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <Building2 className="h-4 w-4" />
      <span>Empresa</span>
    </button>

  </div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    

    
      <div>
    
        <label className={LABEL_CLASS}>
  {form.personType === "pj"
    ? "Nome da empresa"
    : "Nome completo"}
</label>

        <input
          className={INPUT_CLASS}
          type="text"
          value={form.fullName}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              fullName: e.target.value,
            }))
          }
        />
      </div>

<div>
  <label className={LABEL_CLASS}>
    {form.personType === "pj" ? "CNPJ" : "CPF"}
  </label>

  <input
    className={INPUT_CLASS}
    type="text"
    inputMode="numeric"
    placeholder={
      form.personType === "pj"
        ? "00.000.000/0000-00"
        : "000.000.000-00"
    }
    value={form.cpf}
    onChange={(e) =>
      setForm((prev) => ({
        ...prev,
        cpf:
          prev.personType === "pj"
            ? maskCnpj(e.target.value)
            : maskCpf(e.target.value),
      }))
    }
  />
  {docInvalid && (
    <p className="mt-1 text-xs text-amber-500">
      {isPj
        ? "CNPJ inválido — verifique os dígitos."
        : "CPF inválido — verifique os dígitos."}
    </p>
  )}
</div>

      <div>
        <label className={LABEL_CLASS}>
          Telefone
        </label>

        <input
          className={INPUT_CLASS}
          type="text"
          placeholder="(11) 99999-9999"
          value={form.phone}
       onChange={(e) =>
  setForm((prev) => ({
    ...prev,
    phone: maskPhone(e.target.value),
  }))
}
        />
      </div>

  <div>
        <label className={LABEL_CLASS}>
          Cargo (opcional)
        </label>

        <input
          className={INPUT_CLASS}
          type="text"
          value={form.position}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              position: e.target.value,
            }))
          }
        />
      </div>

</div>

    


<div className="rounded-xl bg-brand/5 p-3 space-y-2">
<h3 className="font-semibold text-md">
Endereço de cobrança
</h3>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div>
<label className={LABEL_CLASS}>
CEP
</label>

<input
  value={form.postalCode}
  onChange={async (e) => {

    const cep = formatCep(e.target.value);

    setForm((prev) => ({
      ...prev,
      postalCode: cep,
    }));

    const endereco = await buscarCep(cep);

    if (!endereco) return;

    setForm((prev) => ({
      ...prev,
      postalCode: cep,
      street: endereco.logradouro,
      district: endereco.bairro,
      city: endereco.localidade,
      state: endereco.uf,
    }));

  }}
  className={INPUT_CLASS}
  placeholder="00000-000"
/>
</div>
<div>
<label className={LABEL_CLASS}>
Rua
</label>

<input
className={INPUT_CLASS}
value={form.street}
readOnly
/>
</div>
<div>
<label className={LABEL_CLASS}>
Bairro
</label>

<input
className={INPUT_CLASS}
value={form.district}
readOnly
/>
</div><div>
<label className={LABEL_CLASS}>
Cidade
</label>

<input
className={INPUT_CLASS}
value={form.city}
readOnly
/>
</div>
<div>
<label className={LABEL_CLASS}>
Estado
</label>

<input
className={INPUT_CLASS}
value={form.state}
readOnly
/>
</div>



<div className="grid grid-cols-2 gap-4">

<div>

<label className={LABEL_CLASS}>
Número
</label>

<input
value={form.addressNumber}
onChange={(e)=>
setForm((prev)=>({
...prev,
addressNumber:e.target.value,
}))
}
className={INPUT_CLASS}
/>

</div>

<div>

<label className={LABEL_CLASS}>
Complemento
</label>

<input
value={form.addressComplement}
onChange={(e)=>
setForm((prev)=>({
...prev,
addressComplement:e.target.value,
}))
}
className={INPUT_CLASS}
placeholder="Opcional"
/>

</div>

</div>

</div>

    </div>
  );
}