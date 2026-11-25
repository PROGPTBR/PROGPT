'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { lerRegua, reguaDo, reguaTexto } from '@/lib/medico/regua';
import type { Hospital } from '@/lib/medico/types';
import { Botao, CAMPO, CARTAO, ROTULO, type PropsDaAba, Info } from './ui';

// Cadastros: os hospitais onde o médico opera, o contador que emite as notas
// e o nome que assina os e-mails.

export function Cadastros({ estado, enviar }: PropsDaAba) {
  const [config, setConfig] = useState(estado.config);
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({ nome: '', email: '', prazo: '30' });
  const [criando, setCriando] = useState(false);

  async function salvarConfig() {
    setSalvando(true);
    const { medico_nome, contador_nome, contador_email, empresa_nome, empresa_cnpj, crm, especialidade, contato } = config;
    await enviar('PUT', '/config', { medico_nome, contador_nome, contador_email, empresa_nome, empresa_cnpj, crm, especialidade, contato }, 'Dados salvos.');
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
        <h2 className="text-base font-semibold flex items-center gap-1">Hospitais <Info>O prazo é quantos dias o hospital costuma levar para pagar. Passou disso, o sistema avisa.</Info></h2>
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
        <h2 className="text-base font-semibold flex items-center gap-1">Contador e assinatura <Info>Usados nos e-mails prontos: o pedido de nota vai para o contador e o seu nome assina as mensagens.</Info></h2>
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
          <p className="mt-2 text-sm font-medium">Dados para a planilha de pendências</p>
          <p className="-mt-2 text-xs text-muted-foreground">Saem no cabeçalho da planilha que o hospital exige para cobrar cirurgia não paga.</p>
          <label>
            <span className={ROTULO}>Seu nome completo</span>
            <input value={config.medico_nome} onChange={(e) => setConfig({ ...config, medico_nome: e.target.value })} className={CAMPO} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={ROTULO}>Empresa (razão social)</span>
              <input value={config.empresa_nome} onChange={(e) => setConfig({ ...config, empresa_nome: e.target.value })} className={CAMPO} />
            </label>
            <label>
              <span className={ROTULO}>CNPJ</span>
              <input value={config.empresa_cnpj} onChange={(e) => setConfig({ ...config, empresa_cnpj: e.target.value })} inputMode="numeric" className={CAMPO} />
            </label>
            <label>
              <span className={ROTULO}>CRM</span>
              <input value={config.crm} onChange={(e) => setConfig({ ...config, crm: e.target.value })} className={CAMPO} />
            </label>
            <label>
              <span className={ROTULO}>Especialidade</span>
              <input value={config.especialidade} onChange={(e) => setConfig({ ...config, especialidade: e.target.value })} className={CAMPO} />
            </label>
            <label className="sm:col-span-2">
              <span className={ROTULO}>Telefone de contato</span>
              <input value={config.contato} onChange={(e) => setConfig({ ...config, contato: e.target.value })} inputMode="tel" className={CAMPO} />
            </label>
          </div>
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
  const [meses, setMeses] = useState(String(h.demonstrativo_meses ?? 2));
  const [dia, setDia] = useState(String(h.demonstrativo_dia ?? 10));
  const [regua, setRegua] = useState(reguaTexto(reguaDo(h)));
  const mudou = email !== h.email || prazo !== String(h.prazo_pagamento_dias) || meses !== String(h.demonstrativo_meses ?? 2) || dia !== String(h.demonstrativo_dia ?? 10) || regua !== reguaTexto(reguaDo(h));
  const entre = (v: string, min: number, max: number, padrao: number) => Math.min(max, Math.max(min, Number(v) || padrao));

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
        <span className={ROTULO}>Paga em (dias)</span>
        <input value={prazo} onChange={(e) => setPrazo(e.target.value)} inputMode="numeric" className={CAMPO} />
      </label>
      <div className="flex items-center justify-end gap-1">
        {mudou && (
          <Botao tipo="secundario" onClick={() => void enviar('PATCH', `/hospitais/${h.id}`, { email, prazo_pagamento_dias: Math.min(365, Math.max(0, Number(prazo) || 0)), demonstrativo_meses: entre(meses, 1, 6, 2), demonstrativo_dia: entre(dia, 1, 28, 10), regua: lerRegua(regua) }, 'Hospital atualizado.')}>
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
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 sm:col-span-6">
        <span className="flex items-center gap-1">
          Demonstrativo chega até o dia{' '}
          <Info>O hospital paga por mês. Informe até quando costuma chegar o demonstrativo das cirurgias de um mês. Exemplo: cirurgias de novembro, demonstrativo até o dia 10 de janeiro = dia 10 do 2º mês seguinte. Passou dessa data sem a cirurgia aparecer, ela vira pendência.</Info>
        </span>
        <input value={dia} onChange={(e) => setDia(e.target.value)} inputMode="numeric" aria-label="Dia em que o demonstrativo chega" className={`${CAMPO} !w-16 text-center`} />
        <span>do</span>
        <select value={meses} onChange={(e) => setMeses(e.target.value)} aria-label="Mês em que o demonstrativo chega" className={`${CAMPO} !w-auto`}>
          <option value="1">mês seguinte</option>
          <option value="2">2º mês seguinte</option>
          <option value="3">3º mês seguinte</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 sm:col-span-6">
        <span className="flex items-center gap-1">
          Régua de cobrança (dias){' '}
          <Info>Quando a planilha de pendências sai de novo. O primeiro número conta do vencimento (0 = cobra no dia); os seguintes contam da cobrança anterior. Acabou a lista, repete o último. Padrão 0, 15, 30: cobra no vencimento, de novo em 15 dias, e daí a cada 30.</Info>
        </span>
        <input value={regua} onChange={(e) => setRegua(e.target.value)} onBlur={() => setRegua(reguaTexto(lerRegua(regua)))} aria-label="Régua de cobrança" placeholder="0, 15, 30" className={`${CAMPO} !w-40`} />
      </div>
    </li>
  );
}
