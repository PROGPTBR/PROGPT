'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Loader2, Save } from 'lucide-react';

// Dados da empresa que entram nos documentos gerados (capa do RFP, banner da
// planilha, cláusulas). Simplificado para clientes leigos no sub-projeto 72:
// o essencial fica à mostra e o resto em "Mais detalhes (opcional)".
//
// Saíram de propósito: a chave Pessoa Física/Jurídica (o CPF digitado ali
// NUNCA era salvo — ficava só em estado local e sumia ao recarregar) e um
// bloco "Plano Pro" com preço fixo desatualizado. Plano e preço vivem na tela
// de Assinatura.

type CompanyData = {
  company_name: string;
  company_legal_name: string;
  company_cnpj: string;
  company_email: string;
  company_phone: string;
  company_address: string;
  company_description: string;
};

const EMPTY: CompanyData = {
  company_name: '',
  company_legal_name: '',
  company_cnpj: '',
  company_email: '',
  company_phone: '',
  company_address: '',
  company_description: '',
};

function withDefaults(d: Partial<Record<keyof CompanyData, string | null>>): CompanyData {
  const out = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof CompanyData)[]) out[k] = d[k] ?? '';
  return out;
}

const INPUT =
  'w-full rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-brand focus:bg-muted/60';
const LABEL = 'mb-1.5 block text-sm font-medium text-foreground';
const AJUDA = 'mt-1 text-xs text-muted-foreground';

export function ProfileCompanyForm() {
  const [values, setValues] = useState<CompanyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile/company', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setValues(withDefaults((await res.json()) as Partial<Record<keyof CompanyData, string | null>>));
    } catch {
      toast.error('Não foi possível carregar os dados da empresa. Recarregue a página.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof CompanyData>(k: K, v: string) {
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
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success('Dados salvos. Eles já aparecem nos próximos documentos.');
    } catch {
      toast.error('Não foi possível salvar. Confira os campos e tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Carregando…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="cf-name" className={LABEL}>
            Nome da empresa
          </label>
          <input
            id="cf-name"
            value={values.company_name}
            onChange={(e) => set('company_name', e.target.value)}
            placeholder="Ex.: ACME Indústria"
            maxLength={200}
            className={INPUT}
          />
          <p className={AJUDA}>É o nome que aparece nos documentos.</p>
        </div>
        <div>
          <label htmlFor="cf-cnpj" className={LABEL}>
            CNPJ <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="cf-cnpj"
            value={values.company_cnpj}
            onChange={(e) => set('company_cnpj', e.target.value)}
            placeholder="00.000.000/0001-00"
            maxLength={32}
            inputMode="numeric"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="cf-phone" className={LABEL}>
            Telefone <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="cf-phone"
            value={values.company_phone}
            onChange={(e) => set('company_phone', e.target.value)}
            placeholder="(11) 99999-9999"
            maxLength={32}
            inputMode="tel"
            className={INPUT}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cf-email" className={LABEL}>
            E-mail de contato <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="cf-email"
            type="email"
            value={values.company_email}
            onChange={(e) => set('company_email', e.target.value)}
            placeholder="compras@empresa.com.br"
            maxLength={320}
            className={INPUT}
          />
          <p className={AJUDA}>Para onde os fornecedores devem responder.</p>
        </div>
      </div>

      <details className="group rounded-xl border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          Mais detalhes (opcional)
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div>
            <label htmlFor="cf-legal" className={LABEL}>
              Razão social
            </label>
            <input
              id="cf-legal"
              value={values.company_legal_name}
              onChange={(e) => set('company_legal_name', e.target.value)}
              placeholder="Ex.: ACME Indústria e Comércio Ltda."
              maxLength={200}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="cf-address" className={LABEL}>
              Endereço
            </label>
            <input
              id="cf-address"
              value={values.company_address}
              onChange={(e) => set('company_address', e.target.value)}
              placeholder="Rua, número — bairro — cidade/UF — CEP"
              maxLength={500}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="cf-desc" className={LABEL}>
              Apresentação da empresa
            </label>
            <textarea
              id="cf-desc"
              value={values.company_description}
              onChange={(e) => set('company_description', e.target.value)}
              placeholder="Duas ou três frases sobre a empresa. Usada na carta de abertura do RFP."
              maxLength={1000}
              className={`${INPUT} min-h-[96px] resize-y`}
            />
            <p className={`${AJUDA} text-right`}>{values.company_description.length}/1000</p>
          </div>
        </div>
      </details>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-brand-gradient px-6 text-sm font-medium text-black transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {saving ? 'Salvando…' : 'Salvar dados'}
        </button>
      </div>
    </form>
  );
}
