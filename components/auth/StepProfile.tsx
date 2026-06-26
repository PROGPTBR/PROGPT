import { INPUT_CLASS, LABEL_CLASS } from "./constants";
import type { SignupForm } from "./types";
import { maskCpf, maskPhone, formatCep } from "./masks";
import { buscarCep } from "./viaCep";

type StepProfileProps = {
  form: SignupForm;
  setForm: React.Dispatch<React.SetStateAction<SignupForm>>;
};

export default function StepProfile({
  form,
  setForm,
}: StepProfileProps) {
  return (

    <div className="space-y-6">
        <div className="rounded-xl bg-brand/5 p-3 space-y-2">
<h3 className="font-semibold text-md">
Dados pessoais
</h3>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    
      <div>
        <label className={LABEL_CLASS}>
          Nome completo
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
          CPF
        </label>

        <input
          className={INPUT_CLASS}
          type="text"
          placeholder="000.000.000-00"
          value={form.cpf}
         onChange={(e) =>
  setForm((prev) => ({
    ...prev,
    cpf: maskCpf(e.target.value),
  }))
}
        />
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
          Empresa (opcional)
        </label>

        <input
          className={INPUT_CLASS}
          type="text"
          value={form.companyName}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              companyName: e.target.value,
            }))
          }
        />
      </div>

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