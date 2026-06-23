'use client';

import { useState } from 'react';
import { Loader2, KeyRound, Check, ShieldCheck, Ban } from 'lucide-react';
import { toast } from 'sonner';

type Settings = {
  asaasApiUrl: string;
  planPrice: number;
  trialDays: number;
  hasKey: boolean;
  maskedKey: string;
};

type UserRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  trialEnd: string | null;
  periodEnd: string | null;
  updatedAt: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  none: { label: 'Sem assinatura', cls: 'text-muted-foreground border-border' },
  pending: { label: 'Aguardando', cls: 'text-amber-600 dark:text-amber-300 border-amber-500/40 bg-amber-500/10' },
  trialing: { label: 'Trial (3 dias)', cls: 'text-brand border-brand/40 bg-brand/10' },
  active: { label: 'Ativa', cls: 'text-emerald-600 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10' },
  past_due: { label: 'Em atraso', cls: 'text-red-600 dark:text-red-300 border-red-500/40 bg-red-500/10' },
  cancelled: { label: 'Cancelada', cls: 'text-muted-foreground border-border' },
  expired: { label: 'Bloqueada', cls: 'text-red-600 dark:text-red-300 border-red-500/40 bg-red-500/10' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function BillingAdmin({
  settings,
  users,
}: {
  settings: Settings;
  users: UserRow[];
}) {
  const [apiUrl, setApiUrl] = useState(settings.asaasApiUrl);
  const [apiKey, setApiKey] = useState('');
  const [planPrice, setPlanPrice] = useState(String(settings.planPrice));
  const [trialDays, setTrialDays] = useState(String(settings.trialDays));
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState(users);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/billing/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asaasApiUrl: apiUrl.trim(),
          ...(apiKey.trim() ? { asaasApiKey: apiKey.trim() } : {}),
          planPrice: Number(planPrice),
          trialDays: Number(trialDays),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('Config do Asaas salva.');
      setApiKey('');
    } catch {
      toast.error('Falha ao salvar a config.');
    } finally {
      setSaving(false);
    }
  }

  async function setAccess(id: string, action: 'release' | 'block') {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/billing/users/${id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { status } = (await res.json()) as { status: string };
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success(action === 'release' ? 'Acesso liberado.' : 'Acesso bloqueado.');
    } catch {
      toast.error('Falha na operação.');
    } finally {
      setBusyId(null);
    }
  }

  const INPUT =
    'w-full rounded-lg bg-muted/40 border border-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-colors';
  const LABEL = 'block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5';

  return (
    <div className="max-w-4xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Faturamento <span className="text-brand">.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuração do Asaas e gestão de acesso dos usuários (trial de 3 dias).
        </p>
      </header>

      {/* Config Asaas */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-brand" aria-hidden="true" />
          <h2 className="text-base font-semibold text-foreground">Configuração do Asaas</h2>
        </div>
        <form onSubmit={saveSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>URL da API</label>
              <input
                className={INPUT}
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://www.asaas.com/api/v3"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sandbox: …/sandbox.asaas.com · Produção: …/www.asaas.com
              </p>
            </div>
            <div>
              <label className={LABEL}>
                Chave da API {settings.hasKey && <span className="text-emerald-500">· configurada</span>}
              </label>
              <input
                className={INPUT}
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings.hasKey ? settings.maskedKey : 'cole a chave do Asaas'}
                autoComplete="off"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Deixe em branco pra manter a atual. Nunca é exibida em claro.
              </p>
            </div>
            <div>
              <label className={LABEL}>Preço do plano (R$/mês)</label>
              <input
                className={INPUT}
                type="number"
                step="0.01"
                value={planPrice}
                onChange={(e) => setPlanPrice(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Dias de trial grátis</label>
              <input
                className={INPUT}
                type="number"
                min="0"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-black h-10 px-5 text-sm font-semibold brand-glow hover:brightness-110 disabled:opacity-50 transition-all active:scale-95"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar configuração
          </button>
        </form>
      </section>

      {/* Usuários */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Usuários &amp; acesso</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Trial até</th>
                <th className="py-2 pr-4 font-medium">Próx. cobrança</th>
                <th className="py-2 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const st = STATUS_LABEL[u.status] ?? {
                  label: u.status,
                  cls: 'text-muted-foreground border-border',
                };
                return (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 text-foreground">
                      {u.email}
                      {u.role === 'admin' && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wider text-brand">admin</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{fmtDate(u.trialEnd)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{fmtDate(u.periodEnd)}</td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAccess(u.id, 'release')}
                          disabled={busyId === u.id}
                          title="Liberar acesso"
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 px-2.5 py-1 text-xs transition-colors disabled:opacity-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Liberar
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccess(u.id, 'block')}
                          disabled={busyId === u.id}
                          title="Bloquear acesso"
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/20 px-2.5 py-1 text-xs transition-colors disabled:opacity-50"
                        >
                          <Ban className="h-3.5 w-3.5" /> Bloquear
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nenhum usuário.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
