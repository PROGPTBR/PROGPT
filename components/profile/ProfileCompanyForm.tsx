'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type CompanyData = {
  company_name: string | null;
  company_legal_name: string | null;
  company_cnpj: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  company_description: string | null;
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

export function ProfileCompanyForm() {
  const [values, setValues] = useState<CompanyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  if (loading) {
    return <div className="text-xs text-muted-foreground">Carregando…</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-border bg-card p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium block mb-1">Nome fantasia</label>
          <Input
            value={values.company_name ?? ''}
            onChange={(e) => setField('company_name', e.target.value)}
            placeholder="Ex: ACME"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Razão social</label>
          <Input
            value={values.company_legal_name ?? ''}
            onChange={(e) => setField('company_legal_name', e.target.value)}
            placeholder="Ex: ACME Indústria e Comércio Ltda."
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">CNPJ</label>
          <Input
            value={values.company_cnpj ?? ''}
            onChange={(e) => setField('company_cnpj', e.target.value)}
            placeholder="XX.XXX.XXX/0001-XX"
            maxLength={32}
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Telefone de contato</label>
          <Input
            value={values.company_phone ?? ''}
            onChange={(e) => setField('company_phone', e.target.value)}
            placeholder="(11) 9 9999-9999"
            maxLength={32}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium block mb-1">E-mail de contato</label>
          <Input
            type="email"
            value={values.company_email ?? ''}
            onChange={(e) => setField('company_email', e.target.value)}
            placeholder="compras@empresa.com.br"
            maxLength={320}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium block mb-1">Endereço</label>
          <Input
            value={values.company_address ?? ''}
            onChange={(e) => setField('company_address', e.target.value)}
            placeholder="Rua Exemplo, 100 — Bairro — Cidade/UF — CEP"
            maxLength={500}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium block mb-1">
            Descrição da empresa
          </label>
          <textarea
            value={values.company_description ?? ''}
            onChange={(e) => setField('company_description', e.target.value)}
            placeholder="Apresentação curta usada na carta de abertura do RFP"
            className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
            maxLength={1000}
          />
          <div className="text-[10px] text-muted-foreground text-right mt-0.5">
            {(values.company_description ?? '').length}/1000
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Estes dados aparecem automaticamente nos documentos gerados pelos assistentes
        (apresentação do RFP, banner da planilha de cotação e termos contratuais).
      </p>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" />
          {saving ? 'Salvando…' : 'Salvar dados da empresa'}
        </Button>
      </div>
    </form>
  );
}
