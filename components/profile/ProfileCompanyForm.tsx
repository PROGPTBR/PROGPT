'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

type CompanyData = {
  company_name: string | null;
  company_legal_name: string | null;
  company_cnpj: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  company_description: string | null;
};

type CustomerType = 'pf' | 'pj';

const EMPTY: CompanyData = {
  company_name: '',
  company_legal_name: '',
  company_cnpj: '',
  company_email: '',
  company_phone: '',
  company_address: '',
  company_description: '',
};

function withDefaults(d: Partial<CompanyData>): CompanyData {
  return {
    company_name: d.company_name ?? '',
    company_legal_name: d.company_legal_name ?? '',
    company_cnpj: d.company_cnpj ?? '',
    company_email: d.company_email ?? '',
    company_phone: d.company_phone ?? '',
    company_address: d.company_address ?? '',
    company_description: d.company_description ?? '',
  };
}

const FIELD_INPUT_CLASS =
  'w-full rounded-lg bg-muted/40 border border-border px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors';

const FIELD_LABEL_CLASS =
  'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2';

export function ProfileCompanyForm() {
  const [values, setValues] = useState<CompanyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // =========================
  // PF / PJ
  // =========================
  const [customerType, setCustomerType] = useState<CustomerType>('pf');
  const [cpf, setCpf] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile/company', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as Partial<CompanyData>;
      setValues(withDefaults(data));
    } catch (err) {
      toast.error('Falha ao carregar dados', { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setField<K extends keyof CompanyData>(k: K, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/profile/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }
      toast.success('Dados salvos');
    } catch (err) {
      toast.error('Falha ao salvar', { description: String(err) });
    } finally {
      setSaving(false);
    }
  }

// =========================
  // VALIDATION BILLING
  // =========================
  {/* function canCheckout() {
    if (!values.company_name) return false;
    if (!values.company_email) return false;

    if (customerType === 'pf') {
      return cpf.length >= 11;
    }

    return (values.company_cnpj ?? '').length >= 14;
  }
 */}
  // =========================
  // CHECKOUT ASAAS
  // =========================
  {/* async function handleCheckout() {
    setBillingLoading(true);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.company_name,
          customerType,
          cpf: customerType === 'pf' ? cpf : undefined,
          cnpj: customerType === 'pj' ? values.company_cnpj : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'checkout_error');
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      toast.error('Erro ao iniciar pagamento', {
        description: String(err),
      });
    } finally {
      setBillingLoading(false);
    }
  } 

  function PlanCard({ plan }: { plan: any }) {
  return (
    <div className="pt-6 border-t border-border space-y-3">
      <h3 className="text-sm font-medium">
        {plan.name}
      </h3>
    </div>
  );
}*/}

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-xs text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-border bg-card p-6"
    >

 {/* =========================
          PF / PJ SWITCH
      ========================= 
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setCustomerType('pf')}
          className={`px-3 py-1 rounded-md text-sm ${
            customerType === 'pf'
              ? 'bg-brand-gradient text-black'
              : 'bg-primary text-primary-foreground border border-border'
          }`}
        >
          Pessoa Física
        </button>

        <button
          type="button"
          onClick={() => setCustomerType('pj')}
          className={`px-3 py-1 rounded-md text-sm ${
            customerType === 'pj'
              ? 'bg-brand-gradient text-black'
              : 'bg-primary text-primary-foreground border border-border'
          }`}
        >
          Pessoa Jurídica
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cf-name" className={FIELD_LABEL_CLASS}>
            Nome fantasia
          </label>
          <input
            id="cf-name"
            value={values.company_name ?? ''}
            onChange={(e) => setField('company_name', e.target.value)}
            placeholder="Ex: ACME"
            maxLength={200}
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="cf-legal" className={FIELD_LABEL_CLASS}>
            Razão social
          </label>
          <input
            id="cf-legal"
            value={values.company_legal_name ?? ''}
            onChange={(e) => setField('company_legal_name', e.target.value)}
            placeholder="Ex: ACME Indústria e Comércio Ltda."
            maxLength={200}
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="cf-cnpj" className={FIELD_LABEL_CLASS}>
            CNPJ
          </label>
          <input
            id="cf-cnpj"
            value={values.company_cnpj ?? ''}
            onChange={(e) => setField('company_cnpj', e.target.value)}
            placeholder="XX.XXX.XXX/0001-XX"
            maxLength={32}
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor="cf-phone" className={FIELD_LABEL_CLASS}>
            Telefone de contato
          </label>
          <input
            id="cf-phone"
            value={values.company_phone ?? ''}
            onChange={(e) => setField('company_phone', e.target.value)}
            placeholder="(11) 9 9999-9999"
            maxLength={32}
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cf-email" className={FIELD_LABEL_CLASS}>
            E-mail de contato
          </label>
          <input
            id="cf-email"
            type="email"
            value={values.company_email ?? ''}
            onChange={(e) => setField('company_email', e.target.value)}
            placeholder="compras@empresa.com.br"
            maxLength={320}
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cf-address" className={FIELD_LABEL_CLASS}>
            Endereço
          </label>
          <input
            id="cf-address"
            value={values.company_address ?? ''}
            onChange={(e) => setField('company_address', e.target.value)}
            placeholder="Rua Exemplo, 100 — Bairro — Cidade/UF — CEP"
            maxLength={500}
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cf-desc" className={FIELD_LABEL_CLASS}>
            Descrição da empresa
          </label>
          <textarea
            id="cf-desc"
            value={values.company_description ?? ''}
            onChange={(e) => setField('company_description', e.target.value)}
            placeholder="Apresentação curta usada na carta de abertura do RFP"
            className={`${FIELD_INPUT_CLASS} min-h-[100px] resize-none`}
            maxLength={1000}
          />
          <div className="text-[10px] text-muted-foreground text-right mt-1.5">
            {(values.company_description ?? '').length}/1000
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Estes dados aparecem automaticamente nos documentos gerados pelos
        assistentes (apresentação do RFP, banner da planilha de cotação e termos
        contratuais).
      </p>
*/}

  {/* =========================
          PF / PJ SWITCH
      ========================= */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setCustomerType('pf')}
          className={`px-3 py-1 rounded-md text-sm ${
            customerType === 'pf'
              ? 'bg-brand-gradient text-black'
              : 'bg-primary text-primary-foreground border border-border'
          }`}
        >
          Pessoa Física
        </button>

        <button
          type="button"
          onClick={() => setCustomerType('pj')}
          className={`px-3 py-1 rounded-md text-sm ${
            customerType === 'pj'
              ? 'bg-brand-gradient text-black'
              : 'bg-primary text-primary-foreground border border-border'
          }`}
        >
          Pessoa Jurídica
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL_CLASS}>Nome fantasia</label>
          <input
            id="cf-name"
            value={values.company_name ?? ''}
            onChange={(e) => setField('company_name', e.target.value)}
            placeholder="Ex: ACME"
            maxLength={200}
            className={FIELD_INPUT_CLASS}
          />
        </div>
        <div>
          <label className={FIELD_LABEL_CLASS}>
            {customerType === 'pf' ? 'CPF' : 'CNPJ'}
          </label>

          {customerType === 'pf' ? (
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              className={FIELD_INPUT_CLASS}
              placeholder="000.000.000-00"
            />
          ) : (
            <input
              value={values.company_cnpj ?? ''}
              onChange={(e) => setField('company_cnpj', e.target.value)}
              className={FIELD_INPUT_CLASS}
              placeholder="00.000.000/0001-00"
            />
          )}
        </div>

        <div>
          <label className={FIELD_LABEL_CLASS}>Razão social</label>
          <input
            value={values.company_legal_name ?? ''}
            onChange={(e) => setField('company_legal_name', e.target.value)}
            className={FIELD_INPUT_CLASS}
          />
        </div>

        <div>
          <label className={FIELD_LABEL_CLASS}>Telefone</label>
          <input
            value={values.company_phone ?? ''}
            onChange={(e) => setField('company_phone', e.target.value)}
            className={FIELD_INPUT_CLASS}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={FIELD_LABEL_CLASS}>E-mail</label>
          <input
            type="email"
            value={values.company_email ?? ''}
            onChange={(e) => setField('company_email', e.target.value)}
            className={FIELD_INPUT_CLASS}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={FIELD_LABEL_CLASS}>Endereço</label>
          <input
            value={values.company_address ?? ''}
            onChange={(e) => setField('company_address', e.target.value)}
            className={FIELD_INPUT_CLASS}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={FIELD_LABEL_CLASS}>Descrição</label>
          <textarea
            value={values.company_description ?? ''}
            onChange={(e) => setField('company_description', e.target.value)}
            className={`${FIELD_INPUT_CLASS} min-h-[100px]`}
          />
        </div>
      </div>

      {/* =========================
          SAVE PROFILE
      ========================= */}
      <div className="flex justify-end pt-2 border-t border-border">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 bg-brand-gradient text-black px-6 h-10 rounded-full text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Salvando…' : 'Salvar dados'}
        </button>
      </div>

      {/* =========================
          BILLING SECTION
      ========================= */}
 
                <div className="pt-6 border-t border-border space-y-3">
        <h3 className="text-sm font-medium text-foreground"> Plano Pro</h3>

        <p className="text-xs text-muted-foreground">
          R$ 127,99/mês — assinatura mensal
        </p>

       

      </div>
    </form>
  );
}
