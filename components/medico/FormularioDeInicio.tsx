'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, FileUp, Hospital as IconeHospital, Landmark, Paperclip, Trash2, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';

import { BANCOS, DOCUMENTOS_DE_PARTIDA, documentosDePartida, faltaNoInicio } from '@/lib/medico/inicio';
import { TIPO_DE_DOCUMENTO_LABEL, type EstadoMedico, type Hospital, type MedicoConfig, type TipoDeDocumento } from '@/lib/medico/types';
import { Botao, CAMPO, chamar, Info, ROTULO } from './ui';

// Formulário de início (sub-projeto 117): uma pergunta por tela. O médico já
// tem a conta; aqui ele responde só o que a 2B Supply não sabe. Cada passo
// grava ao avançar, então fechar o celular no meio não perde nada.

type Passo = { id: string; titulo: string; icone: React.ComponentType<{ className?: string }> };
const PASSOS: Passo[] = [
  { id: 'voce', titulo: 'Você', icone: UserRound },
  { id: 'empresa', titulo: 'Empresa e contador', icone: Building2 },
  { id: 'hospitais', titulo: 'Hospitais', icone: IconeHospital },
  { id: 'banco', titulo: 'Banco', icone: Landmark },
  { id: 'documentos', titulo: 'Documentos', icone: FileUp },
  { id: 'equipe', titulo: 'Quem opera', icone: Users },
];

const ACEITA = '.pdf,.xml,.xlsx,.xls,.docx,.csv,.ofx,.txt,image/*';

export function FormularioDeInicio({ estadoInicial }: { estadoInicial: EstadoMedico }) {
  const [estado, setEstado] = useState(estadoInicial);
  const [config, setConfig] = useState<MedicoConfig>(estadoInicial.config);
  const [passo, setPasso] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const faltam = useMemo(() => faltaNoInicio({ ...estado, config }), [estado, config]);
  const fim = passo === PASSOS.length;

  async function recarregar() {
    const r = await chamar<EstadoMedico>('GET', '');
    if (r.ok) setEstado(r.dados);
  }

  /** Grava a config atual e anda um passo. */
  async function avancar() {
    setSalvando(true);
    const dados: Record<string, unknown> = { ...config };
    for (const k of ['inicio_status', 'inicio_em', 'grupo_jid', 'grupo_nome']) delete dados[k];
    const r = await chamar('PUT', '/inicio', dados);
    setSalvando(false);
    if (!r.ok) return void toast.error(r.mensagem);
    setPasso((p) => p + 1);
    window.scrollTo?.({ top: 0 });
  }

  async function fechar(acao: 'concluir' | 'pular') {
    setSalvando(true);
    const r = await chamar('POST', '/inicio', { acao });
    setSalvando(false);
    if (!r.ok) return void toast.error(r.mensagem);
    window.location.href = '/area-medica';
  }

  const campo = (k: keyof MedicoConfig) => ({ value: String(config[k] ?? ''), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setConfig({ ...config, [k]: e.target.value }), className: CAMPO });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6 lg:pt-10">
      {/* Progresso */}
      <ol className="mb-6 flex items-center gap-1.5" aria-label="Progresso">
        {PASSOS.map((p, i) => (
          <li key={p.id} className={`h-1.5 flex-1 rounded-full ${i < passo || fim ? 'bg-medico' : i === passo ? 'bg-medico/50' : 'bg-neutral-200'}`} title={p.titulo} />
        ))}
      </ol>

      {!fim && (
        <header className="mb-5">
          <p className="text-xs font-medium uppercase tracking-wider text-medico">
            Passo {passo + 1} de {PASSOS.length}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{PASSOS[passo]!.titulo}</h1>
        </header>
      )}

      {passo === 0 && (
        <Tela intro="Sua conta já está criada. Agora precisamos de poucas respostas, só o que a 2B Supply não sabe. Leva uns 5 minutos e você pode parar e voltar depois.">
          <p className="text-sm text-muted-foreground">Confira o que a equipe já preencheu e complete o que faltar.</p>
          <L rotulo="Seu nome, como assina">
            <input {...campo('medico_nome')} placeholder="Dr. ..." />
          </L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L rotulo="CRM">
              <input {...campo('crm')} placeholder="CRM/RJ 00000" />
            </L>
            <L rotulo="Especialidade">
              <input {...campo('especialidade')} placeholder="Cirurgia geral" />
            </L>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <L rotulo="WhatsApp" ajuda="É para onde vão o resumo da manhã e o lembrete da agenda. Só você recebe.">
              <input {...campo('whatsapp_numero')} inputMode="tel" placeholder="(21) 9 9999-9999" />
            </L>
            <L rotulo="E-mail para respostas" ajuda="Quando o sistema manda um e-mail em seu nome ao contador ou ao hospital, a resposta volta para este endereço.">
              <input {...campo('medico_email')} type="email" placeholder="voce@..." />
            </L>
          </div>
        </Tela>
      )}

      {passo === 1 && (
        <Tela intro="A nota fiscal sai da sua empresa. O pedido de nota vai para o contador, já com o valor e o tomador.">
          <L rotulo="Razão social da empresa">
            <input {...campo('empresa_nome')} placeholder="Nome Sobrenome Serviços Médicos Ltda" />
          </L>
          <L rotulo="CNPJ">
            <input {...campo('empresa_cnpj')} inputMode="numeric" placeholder="00.000.000/0001-00" />
          </L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L rotulo="Nome do contador">
              <input {...campo('contador_nome')} />
            </L>
            <L rotulo="E-mail do contador" ajuda="O pedido de nota sai sozinho para este e-mail, sem nome de paciente.">
              <input {...campo('contador_email')} type="email" />
            </L>
          </div>
        </Tela>
      )}

      {passo === 2 && (
        <Tela intro="Um por um, os hospitais onde você opera. O ciclo de cada um é o que o sistema usa para saber quando uma cirurgia ficou de fora.">
          <Hospitais hospitais={estado.hospitais.filter((h) => !h.exemplo)} recarregar={recarregar} />
        </Tela>
      )}

      {passo === 3 && (
        <Tela intro="Onde o pagamento do hospital cai. Com o banco certo, a equipe inicia a ligação para o sistema ver cada crédito sozinho.">
          <L rotulo="Banco">
            <select {...campo('banco_nome')}>
              <option value="">Escolha...</option>
              {BANCOS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </L>
          {config.banco_nome === 'BTG Pactual' && <p className="rounded-2xl bg-medico/5 p-3 text-sm">O BTG Empresas tem ligação direta: depois que a equipe cadastrar, você autoriza em um clique dentro do app do banco. Até lá, o extrato do mês já resolve a conciliação.</p>}
          {config.banco_nome && config.banco_nome !== 'BTG Pactual' && <p className="rounded-2xl bg-neutral-100 p-3 text-sm">Para este banco, a conciliação é pelo extrato (OFX ou CSV) que você sobe no app. A equipe avalia a ligação direta.</p>}
          <L rotulo="Chave Pix (opcional)" ajuda="Vai junto da nota ao paciente que paga direto a você.">
            <input {...campo('chave_pix')} />
          </L>
        </Tela>
      )}

      {passo === 4 && (
        <Tela intro="Com estes arquivos a equipe lança o primeiro mês no mesmo dia. Só o demonstrativo é obrigatório; o resto pode vir depois, pela aba Documentos.">
          <Documentos documentos={estado.documentos} recarregar={recarregar} />
        </Tela>
      )}

      {passo === 5 && (
        <Tela intro="Se a secretária é quem vai lançar as cirurgias e conferir os demonstrativos, a equipe cria um acesso para ela.">
          <div className="grid gap-3 sm:grid-cols-2">
            <L rotulo="Nome da secretária (opcional)">
              <input {...campo('secretaria_nome')} />
            </L>
            <L rotulo="WhatsApp ou e-mail dela">
              <input {...campo('secretaria_contato')} />
            </L>
          </div>
        </Tela>
      )}

      {fim && (
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.06] sm:p-8">
          <span className={`grid h-12 w-12 place-items-center rounded-full ${faltam.length === 0 ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
            <Check className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{faltam.length === 0 ? 'Tudo pronto' : 'Quase lá'}</h1>
          {faltam.length > 0 ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">Ainda falta:</p>
              <ul className="mt-2 space-y-1 text-sm">
                {faltam.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {f.titulo}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">Pode voltar e completar, ou entrar no app agora e terminar depois pelos primeiros passos.</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">O que acontece agora, do nosso lado:</p>
              <ol className="mt-2 space-y-1.5 text-sm">
                {['A equipe lê o demonstrativo e lança o primeiro mês na sua conta.', 'Suas pendências atuais entram como cobrança, no modelo do hospital.', `Começa a ligação com o ${config.banco_nome || 'banco'} para o sistema ver cada crédito.`, 'Você recebe no WhatsApp o primeiro resumo na manhã seguinte.'].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-medico/10 text-[11px] font-bold text-medico">{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Botao tipo="secundario" onClick={() => setPasso(0)}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Revisar
            </Botao>
            {faltam.length === 0 ? (
              <Botao ocupado={salvando} onClick={() => void fechar('concluir')}>
                Entrar no app <ArrowRight className="h-4 w-4" aria-hidden />
              </Botao>
            ) : (
              <Botao ocupado={salvando} onClick={() => void fechar('pular')}>
                Entrar e terminar depois <ArrowRight className="h-4 w-4" aria-hidden />
              </Botao>
            )}
          </div>
        </div>
      )}

      {!fim && (
        <div className="mt-6 flex items-center justify-between gap-2">
          <button type="button" onClick={() => (passo === 0 ? void fechar('pular') : setPasso(passo - 1))} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {passo === 0 ? 'Responder depois' : 'Voltar'}
          </button>
          <Botao ocupado={salvando} onClick={avancar}>
            {passo === PASSOS.length - 1 ? 'Revisar' : 'Continuar'} <ArrowRight className="h-4 w-4" aria-hidden />
          </Botao>
        </div>
      )}
    </div>
  );
}

function Tela({ intro, children }: { intro: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-black/[0.06] sm:p-6">
      <p className="text-sm leading-relaxed text-neutral-700">{intro}</p>
      {children}
    </div>
  );
}

function L({ rotulo, ajuda, children }: { rotulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`${ROTULO} flex items-center gap-1`}>
        {rotulo}
        {ajuda && <Info>{ajuda}</Info>}
      </span>
      {children}
    </label>
  );
}

// --- Hospitais -------------------------------------------------------------

function Hospitais({ hospitais, recarregar }: { hospitais: Hospital[]; recarregar: () => Promise<void> }) {
  const vazio = { nome: '', email: '', prazo: '30', meses: '2', dia: '10' };
  const [novo, setNovo] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  const entre = (v: string, min: number, max: number, padrao: number) => Math.min(max, Math.max(min, Number(v) || padrao));

  async function adicionar() {
    setSalvando(true);
    const r = await chamar('POST', '/hospitais', { nome: novo.nome.trim(), email: novo.email.trim(), prazo_pagamento_dias: entre(novo.prazo, 0, 365, 30), demonstrativo_meses: entre(novo.meses, 1, 6, 2), demonstrativo_dia: entre(novo.dia, 1, 28, 10) });
    setSalvando(false);
    if (!r.ok) return void toast.error(r.mensagem);
    setNovo(vazio);
    await recarregar();
  }

  async function remover(h: Hospital) {
    if (!window.confirm(`Tirar ${h.nome}?`)) return;
    const r = await chamar('DELETE', `/hospitais/${h.id}`);
    if (!r.ok) return void toast.error(r.mensagem);
    await recarregar();
  }

  return (
    <div className="space-y-4">
      {hospitais.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {hospitais.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{h.nome}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {h.email || 'sem e-mail'} · paga em {h.prazo_pagamento_dias} dias · demonstrativo até dia {h.demonstrativo_dia ?? 10} do {h.demonstrativo_meses ?? 2}º mês
                </span>
              </span>
              <button type="button" onClick={() => void remover(h)} aria-label={`Tirar ${h.nome}`} className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-red-600">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-3 rounded-2xl bg-neutral-50 p-4">
        <p className="text-sm font-medium">{hospitais.length === 0 ? 'Primeiro hospital' : 'Mais um hospital'}</p>
        <L rotulo="Nome do hospital">
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className={CAMPO} />
        </L>
        <L rotulo="E-mail do setor de honorários" ajuda="Para onde vão a nota e a planilha de pendências. Está no rodapé do demonstrativo ou com a secretária do setor.">
          <input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} className={CAMPO} />
        </L>
        <div className="grid grid-cols-3 gap-2">
          <L rotulo="Paga em (dias)" ajuda="Depois de receber a nota, em quantos dias o hospital costuma pagar.">
            <input value={novo.prazo} onChange={(e) => setNovo({ ...novo, prazo: e.target.value })} inputMode="numeric" className={CAMPO} />
          </L>
          <L rotulo="Demonstrativo até dia" ajuda="O demonstrativo das cirurgias de um mês chega até este dia...">
            <input value={novo.dia} onChange={(e) => setNovo({ ...novo, dia: e.target.value })} inputMode="numeric" className={CAMPO} />
          </L>
          <L rotulo="do ...º mês seguinte" ajuda="...do mês seguinte (1) ou do segundo mês seguinte (2), que é o mais comum.">
            <input value={novo.meses} onChange={(e) => setNovo({ ...novo, meses: e.target.value })} inputMode="numeric" className={CAMPO} />
          </L>
        </div>
        <Botao tipo="secundario" ocupado={salvando} desabilitado={novo.nome.trim().length < 2} onClick={adicionar}>
          Adicionar hospital
        </Botao>
      </div>
    </div>
  );
}

// --- Documentos ------------------------------------------------------------

function Documentos({ documentos, recarregar }: { documentos: EstadoMedico['documentos']; recarregar: () => Promise<void> }) {
  const contagem = documentosDePartida(documentos);
  return (
    <ul className="space-y-3">
      {DOCUMENTOS_DE_PARTIDA.map((d) => (
        <li key={d.tipo} className="rounded-2xl border border-border p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {d.titulo} {d.obrigatorio ? <span className="text-xs font-normal text-amber-700">obrigatório</span> : <span className="text-xs font-normal text-muted-foreground">se tiver</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{d.porque}</p>
            </div>
            {(contagem[d.tipo] ?? 0) > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                <Check className="h-3 w-3" aria-hidden /> {contagem[d.tipo]}
              </span>
            )}
          </div>
          <Anexo tipo={d.tipo} recarregar={recarregar} />
          {documentos.filter((x) => x.tipo === d.tipo).length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {documentos
                .filter((x) => x.tipo === d.tipo)
                .map((x) => (
                  <li key={x.id} className="truncate">
                    {x.nome}
                  </li>
                ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function Anexo({ tipo, recarregar }: { tipo: TipoDeDocumento; recarregar: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function receber(lista: FileList | null) {
    const arquivos = [...(lista ?? [])].slice(0, 10);
    if (arquivos.length === 0) return;
    setEnviando(true);
    let ok = 0;
    for (const arquivo of arquivos) {
      const fd = new FormData();
      fd.set('arquivo', arquivo);
      fd.set('tipo', tipo);
      try {
        const res = await fetch('/api/medico/documentos', { method: 'POST', body: fd });
        const dados = (await res.json().catch(() => ({}))) as { message?: string };
        if (res.ok) ok += 1;
        else toast.error(`${arquivo.name}: ${dados.message ?? 'não foi possível guardar.'}`);
      } catch {
        toast.error(`${arquivo.name}: sem conexão.`);
      }
    }
    setEnviando(false);
    if (input.current) input.current.value = '';
    if (ok > 0) {
      toast.success(`${TIPO_DE_DOCUMENTO_LABEL[tipo]}: ${ok === 1 ? 'arquivo guardado' : `${ok} arquivos guardados`}.`);
      await recarregar();
    }
  }

  return (
    <div className="mt-2">
      <Botao tipo="secundario" ocupado={enviando} onClick={() => input.current?.click()}>
        <Paperclip className="h-4 w-4" aria-hidden /> Anexar
      </Botao>
      <input ref={input} type="file" accept={ACEITA} multiple className="hidden" onChange={(e) => void receber(e.target.files)} />
    </div>
  );
}
