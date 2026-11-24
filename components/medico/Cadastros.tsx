'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import type { Hospital } from '@/lib/medico/types';
import { Botao, CAMPO, CARTAO, ROTULO, type PropsDaAba } from './ui';

// Cadastros: os hospitais onde o médico opera, o contador que emite as notas
// e o nome que assina os e-mails.

export function Cadastros({ estado, enviar }: PropsDaAba) {
  const [config, setConfig] = useState(estado.config);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({ nome: '', email: '', prazo: '30' });
  const [criando, setCriando] = useState(false);

  async function salvarConfig() {
    setSalvando(true);
    await enviar('PUT', '/config', config, 'Dados salvos.');
    setSalvando(false);
  }

  async function criar() {
    setCriando(true);
    const ok = await enviar('POST', '/hospitais', { nome: novo.nome, email: novo.email, prazo_pagamento_dias: Number(novo.prazo) || 30 }, 'Hospital cadastrado.');
    setCriando(false);
    if (ok) setNovo({ nome: '', email: '', prazo: '30' });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={CARTAO}>
        <h2 className="text-base font-semibold">Hospitais</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">O prazo é quantos dias o hospital costuma levar para pagar. Passou disso, o sistema avisa.</p>
        <ul className="mt-3 space-y-2">
          {estado.hospitais.map((h) => (
            <LinhaDoHospital key={h.id} h={h} enviar={enviar} />
          ))}
        </ul>
        <div className="mt-4 grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-6">
          <label className="sm:col-span-2">
            <span className={ROTULO}>Nome do hospital</span>
            <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className={CAMPO} />
          </label>
          <label className="sm:col-span-3">
            <span className={ROTULO}>E-mail do faturamento</span>
            <input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Prazo (dias)</span>
            <input value={novo.prazo} onChange={(e) => setNovo({ ...novo, prazo: e.target.value })} inputMode="numeric" className={CAMPO} />
          </label>
          <div className="sm:col-span-6">
            <Botao ocupado={criando} desabilitado={novo.nome.trim().length < 2} onClick={criar}>
              <Plus className="h-4 w-4" aria-hidden /> Cadastrar hospital
            </Botao>
          </div>
        </div>
      </section>

      <section className={CARTAO}>
        <h2 className="text-base font-semibold">Contador e assinatura</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Usados nos e-mails prontos: o pedido de nota vai para o contador e o seu nome assina as mensagens.</p>
        <div className="mt-3 grid gap-3">
          <label>
            <span className={ROTULO}>Seu nome (como assina)</span>
            <input value={config.medico_nome} onChange={(e) => setConfig({ ...config, medico_nome: e.target.value })} placeholder="Dr. ..." className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Nome do contador</span>
            <input value={config.contador_nome} onChange={(e) => setConfig({ ...config, contador_nome: e.target.value })} className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>E-mail do contador</span>
            <input type="email" value={config.contador_email} onChange={(e) => setConfig({ ...config, contador_email: e.target.value })} className={CAMPO} />
          </label>
          <div>
            <Botao ocupado={salvando} onClick={salvarConfig}>
              Salvar
            </Botao>
          </div>
        </div>
      </section>
    </div>
  );
}

function LinhaDoHospital({ h, enviar }: { h: Hospital; enviar: PropsDaAba['enviar'] }) {
  const [email, setEmail] = useState(h.email);
  const [prazo, setPrazo] = useState(String(h.prazo_pagamento_dias));
  const mudou = email !== h.email || prazo !== String(h.prazo_pagamento_dias);

  return (
    <li className="grid items-end gap-2 rounded-xl border border-border p-3 sm:grid-cols-6">
      <div className="sm:col-span-2">
        <span className={ROTULO}>Hospital</span>
        <div className="flex h-10 items-center text-sm font-medium">{h.nome}</div>
      </div>
      <label className="sm:col-span-2">
        <span className={ROTULO}>E-mail</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CAMPO} />
      </label>
      <label>
        <span className={ROTULO}>Prazo (dias)</span>
        <input value={prazo} onChange={(e) => setPrazo(e.target.value)} inputMode="numeric" className={CAMPO} />
      </label>
      <div className="flex items-center justify-end gap-1">
        {mudou && (
          <Botao tipo="secundario" onClick={() => void enviar('PATCH', `/hospitais/${h.id}`, { email, prazo_pagamento_dias: Math.min(365, Math.max(0, Number(prazo) || 0)) }, 'Hospital atualizado.')}>
            Salvar
          </Botao>
        )}
        <button
          type="button"
          aria-label={`Apagar ${h.nome}`}
          title="Apagar"
          onClick={() => {
            if (window.confirm(`Apagar ${h.nome}? As cirurgias e os demonstrativos desse hospital são apagados junto.`)) void enviar('DELETE', `/hospitais/${h.id}`, undefined, 'Hospital apagado.');
          }}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
