'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Send, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

import { ConexaoWhatsapp } from '@/components/medico/Integracoes';
import { mensagemDeAcesso } from '@/lib/medico/mensagem-acesso';
import { Botao, brl, CAMPO, CARTAO, chamar, ROTULO, Selo, TD, TH } from '@/components/medico/ui';

// Painel da Área Médica no Super Admin (sub-projeto 107). É onde a 2B Supply
// libera o acesso dos médicos e acompanha o uso do produto. Mostra só
// números: nada de paciente nem de valor por cirurgia.

type Acesso = {
  id: string;
  tipo: string;
  email: string;
  nome: string;
  ultimo_acesso: string | null;
  hospitais: number;
  cirurgias: number;
  pendencias: number;
  demonstrativos: number;
  a_receber: number;
  whatsapp: boolean;
  banco: boolean;
  inicio: 'pendente' | 'respondido' | 'pulado';
  banco_nome: string;
  secretaria: string;
  contador: boolean;
  empresa: boolean;
  documentos: number;
  whatsapp_numero: string;
  email_entrada: string | null;
  demonstrativo_anexado: boolean;
};
type DocAdmin = { id: string; tipo: string; rotulo: string; nome: string; created_at: string; url: string };
type IndicacaoAdmin = { id: string; nome: string; contato: string; situacao: string; created_at: string; indicado_por: string };
type Dados = { acessos: Acesso[]; indicacoes: IndicacaoAdmin[]; avisos: { whatsapp: string | null; email: boolean; btg: boolean } };

export function AreaMedicaAdmin() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState<'medico' | 'equipe'>('medico');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [senha, setSenha] = useState<{ email: string; senha: string } | null>(null);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [docsDe, setDocsDe] = useState<{ id: string; lista: DocAdmin[] } | null>(null);

  async function verDocumentos(a: Acesso) {
    if (docsDe?.id === a.id) return setDocsDe(null);
    const r = await chamar<{ documentos: DocAdmin[] }>('GET', `/acessos/${a.id}/documentos`);
    if (!r.ok) return void toast.error(r.mensagem);
    setDocsDe({ id: a.id, lista: r.dados.documentos });
  }

  const carregar = useCallback(async () => {
    const r = await chamar<Dados>('GET', '/acessos');
    if (r.ok) setDados(r.dados);
    else toast.error(r.mensagem);
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function liberar(modo: 'convite' | 'senha', para = email, comoTipo = tipo) {
    setOcupado(modo + para);
    const r = await chamar<{ convidado: boolean; senha: string | null }>('POST', '/acessos', { email: para, tipo: comoTipo, modo, nome: para === email ? nome : '', whatsapp: para === email ? whatsapp : '' });
    setOcupado(null);
    if (!r.ok) return void toast.error(r.mensagem);
    if (r.dados.senha) setSenha({ email: para.trim().toLowerCase(), senha: r.dados.senha });
    else toast.success(r.dados.convidado ? 'Convite enviado por e-mail: a pessoa cria a senha e entra.' : 'Acesso liberado para a conta que já existia.');
    setEmail('');
    setNome('');
    setWhatsapp('');
    await carregar();
  }

  async function remover(a: Acesso) {
    if (!window.confirm(`Tirar o acesso de ${a.email} à Área Médica? Os dados ficam guardados e voltam se o acesso for devolvido.`)) return;
    const r = await chamar('DELETE', `/acessos?id=${a.id}`);
    if (!r.ok) return void toast.error(r.mensagem);
    await carregar();
  }

  const medicos = dados?.acessos.filter((a) => a.tipo === 'medico') ?? [];
  const emailValido = /^\S+@\S+\.\S+$/.test(email.trim());
  const total = (campo: 'cirurgias' | 'pendencias' | 'a_receber') => medicos.reduce((s, a) => s + a[campo], 0);
  const entrou = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : 'ainda não entrou');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Stethoscope className="h-6 w-6 text-amber-600" aria-hidden /> Área Médica
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Produto à parte do sistema de compras: o médico entra por um endereço próprio e não vê chat, assistentes nem planos.</p>
        </div>
        <a href="/medicos" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
          <ExternalLink className="h-4 w-4" aria-hidden /> Ver a entrada dos médicos
        </a>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Médicos com acesso', String(medicos.length)],
          ['Cirurgias registradas', String(total('cirurgias'))],
          ['Cirurgias ainda sem demonstrativo', String(total('pendencias'))],
          ['A receber (soma dos médicos)', brl(total('a_receber'))],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className={CARTAO}>
            <div className="text-xs font-medium text-muted-foreground">{rotulo}</div>
            <div className="mt-2 text-2xl font-semibold">{dados ? valor : '...'}</div>
          </div>
        ))}
      </div>

      <section className={CARTAO}>
        <h2 className="text-base font-semibold">Liberar acesso</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <strong>Senha temporária:</strong> a conta é criada na hora e a senha aparece aqui uma vez, para você passar ao médico; no primeiro acesso ele cria a dele. <strong>Convite:</strong> ele recebe um e-mail com o link para criar a senha.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[16rem] flex-1">
            <span className={ROTULO}>E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="medico@clinica.com.br" className={CAMPO} />
          </label>
          <label className="min-w-[12rem] flex-1">
            <span className={ROTULO}>Nome (opcional)</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Dr. ..." className={CAMPO} />
          </label>
          <label className="min-w-[10rem]">
            <span className={ROTULO}>WhatsApp (opcional)</span>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(21) 9..." className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Tipo de conta</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as 'medico' | 'equipe')} className={`${CAMPO} !w-auto`}>
              <option value="medico">Médico (só a Área Médica)</option>
              <option value="equipe">Equipe (sistema de compras e Área Médica)</option>
            </select>
          </label>
          <Botao ocupado={ocupado === 'senha' + email} desabilitado={!emailValido || !!ocupado} onClick={() => liberar('senha')}>
            Criar com senha temporária
          </Botao>
          <Botao tipo="secundario" ocupado={ocupado === 'convite' + email} desabilitado={!emailValido || !!ocupado} onClick={() => liberar('convite')}>
            Convidar por e-mail
          </Botao>
        </div>
        {senha && <QuadroDaSenha senha={senha} acesso={dados?.acessos.find((a) => a.email.toLowerCase() === senha.email)} onFechar={() => setSenha(null)} />}
      </section>

      <section className={CARTAO}>
        <h2 className="text-base font-semibold">Contas</h2>
        {!dados ? (
          <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
        ) : dados.acessos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma conta liberada ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className={TH}>Conta</th>
                  <th className={TH}>Último acesso</th>
                  <th className={TH}>Início</th>
                  <th className={`${TH} text-right`}>Hospitais</th>
                  <th className={`${TH} text-right`}>Cirurgias</th>
                  <th className={`${TH} text-right`}>Sem demonstrativo</th>
                  <th className={`${TH} text-right`}>A receber</th>
                  <th className={TH}>Ligações</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dados.acessos.map((a) => (
                  <Fragment key={a.id}>
                  <tr>
                    <td className={TD}>
                      <span className="font-medium">{a.nome || a.email}</span> <Selo cor={a.tipo === 'medico' ? 'azul' : 'neutro'}>{a.tipo === 'medico' ? 'Médico' : 'Equipe'}</Selo>
                      {a.nome && <span className="block break-all text-xs text-muted-foreground">{a.email}</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{entrou(a.ultimo_acesso)}</td>
                    <td className={`${TD} whitespace-nowrap text-xs`}>
                      <Selo cor={a.inicio === 'respondido' ? 'verde' : a.inicio === 'pulado' ? 'amarelo' : 'neutro'}>{a.inicio === 'respondido' ? 'Respondido' : a.inicio === 'pulado' ? 'Incompleto' : 'Pendente'}</Selo>
                      {a.tipo === 'medico' && (
                        <span className="mt-1 block text-muted-foreground">
                          {a.banco_nome || 'banco ?'} · {a.empresa ? 'CNPJ ok' : 'sem CNPJ'} · {a.contador ? 'contador ok' : 'sem contador'}
                          {a.secretaria && <span className="block">Secretária: {a.secretaria}</span>}
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-right`}>{a.hospitais}</td>
                    <td className={`${TD} text-right`}>{a.cirurgias}</td>
                    <td className={`${TD} text-right ${a.pendencias > 0 ? 'font-medium text-red-700 dark:text-red-300' : ''}`}>{a.pendencias}</td>
                    <td className={`${TD} whitespace-nowrap text-right`}>{brl(a.a_receber)}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <Selo cor={a.whatsapp ? 'verde' : 'neutro'}>WhatsApp</Selo> <Selo cor={a.banco ? 'verde' : 'neutro'}>Banco</Selo>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right text-xs`}>
                      <button type="button" disabled={!!ocupado} onClick={() => void liberar('senha', a.email, a.tipo as 'medico' | 'equipe')} className="text-muted-foreground hover:text-foreground">
                        Nova senha temporária
                      </button>
                      <span className="mx-2 text-border">|</span>
                      <button type="button" onClick={() => void verDocumentos(a)} className={`hover:text-foreground ${a.demonstrativo_anexado ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                        Documentos ({a.documentos})
                      </button>
                      <span className="mx-2 text-border">|</span>
                      <button type="button" onClick={() => void remover(a)} className="text-muted-foreground hover:text-red-600">
                        Tirar acesso
                      </button>
                    </td>
                  </tr>
                  {docsDe?.id === a.id && (
                    <tr>
                      <td colSpan={9} className="bg-muted/30 px-4 py-3 text-xs">
                        {docsDe.lista.length === 0 ? (
                          <span className="text-muted-foreground">Nenhum documento anexado ainda.</span>
                        ) : (
                          <ul className="grid gap-1 sm:grid-cols-2">
                            {docsDe.lista.map((d) => (
                              <li key={d.id}>
                                <span className="text-muted-foreground">{d.rotulo}:</span>{' '}
                                <a href={d.url} className="font-medium text-amber-700 hover:underline">
                                  {d.nome}
                                </a>{' '}
                                <span className="text-muted-foreground">({new Date(d.created_at).toLocaleDateString('pt-BR')})</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-2 text-muted-foreground">Os links valem 2 minutos. Cada abertura desta lista fica registrada no log de auditoria.</p>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Os números não contam os dados de exemplo. Verde em WhatsApp = o médico escolheu o grupo das cirurgias; em Banco = ligou a conta. Em Início, Respondido = o médico completou o formulário de início e os documentos dele estão em Documentos: é a hora de lançar o primeiro mês e iniciar a ligação com o banco.</p>
      </section>

      <section className={CARTAO}>
        <h2 className="text-base font-semibold">Colegas indicados pelos médicos</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">São os contatos para a equipe procurar. Marque como anda cada conversa; o médico que indicou vê a situação.</p>
        {!dados || dados.indicacoes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma indicação ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border text-sm">
            {dados.indicacoes.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{i.nome}</span> <span className="text-muted-foreground">· {i.contato}</span>
                  <span className="block text-xs text-muted-foreground">
                    indicado por {i.indicado_por || 'médico'} em {new Date(i.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </span>
                <select
                  value={i.situacao}
                  aria-label={`Situação de ${i.nome}`}
                  onChange={async (e) => {
                    const r = await chamar('PATCH', '/acessos', { id: i.id, situacao: e.target.value });
                    if (!r.ok) toast.error(r.mensagem);
                    await carregar();
                  }}
                  className={`${CAMPO} !w-auto`}
                >
                  <option value="nova">Nova</option>
                  <option value="em_contato">Em contato</option>
                  <option value="virou_cliente">Virou cliente</option>
                  <option value="sem_interesse">Sem interesse</option>
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={CARTAO}>
        <h2 className="text-base font-semibold">Serviços do produto</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Número que envia os avisos diários</p>
            <p className="mb-2 text-xs text-muted-foreground">Um número da 2B Supply, conectado uma vez, que manda o resumo da manhã para todos os médicos.</p>
            {dados?.avisos.whatsapp === null ? <Selo cor="amarelo">WhatsApp desligado no servidor</Selo> : <ConexaoWhatsapp alvo="avisos" />}
          </div>
          <ul className="space-y-2 text-sm">
            <li>
              Envio de e-mail em nome do médico: {dados?.avisos.email ? <Selo cor="verde">Ligado</Selo> : <Selo cor="amarelo">Desligado no servidor</Selo>}
            </li>
            <li>
              Ligação com o BTG Empresas: {dados?.avisos.btg ? <Selo cor="verde">Liberada</Selo> : <Selo cor="amarelo">Aguardando o aplicativo no banco</Selo>}
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

/** A senha temporária e a mensagem completa de acesso, pronta para copiar ou mandar pelo WhatsApp (sub-projeto 119). */
function QuadroDaSenha({ senha, acesso, onFechar }: { senha: { email: string; senha: string }; acesso?: Acesso; onFechar: () => void }) {
  const inicial = mensagemDeAcesso({
    nome: acesso?.nome ?? '',
    email: senha.email,
    senha: senha.senha,
    link: `${typeof window === 'undefined' ? '' : window.location.origin}/medicos`,
    hospitais: acesso?.hospitais ?? 0,
    cirurgias: acesso?.cirurgias ?? 0,
    demonstrativos: acesso?.demonstrativos ?? 0,
    contador: acesso?.contador ?? false,
    celular: !!acesso?.whatsapp_numero,
    emailEntrada: acesso?.email_entrada ?? null,
  });
  const [texto, setTexto] = useState(inicial);
  const [numero, setNumero] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviarPeloSistema() {
    if (!acesso) return;
    setEnviando(true);
    const r = await chamar<{ email: boolean; whatsapp: 'enviado' | 'sem_numero' | 'desligado' | 'falhou' }>('POST', '/acessos/mensagem', { id: acesso.id, texto, whatsapp: numero });
    setEnviando(false);
    if (!r.ok) return void toast.error(r.mensagem);
    const partes = [r.dados.email ? `e-mail enviado para ${senha.email}` : 'o e-mail não saiu (envio de e-mail desligado no servidor)'];
    partes.push(
      { enviado: 'WhatsApp enviado', sem_numero: 'sem WhatsApp cadastrado', desligado: 'o número de avisos da 2B Supply não está conectado', falhou: 'o WhatsApp não saiu' }[r.dados.whatsapp],
    );
    const tudo = r.dados.email && (r.dados.whatsapp === 'enviado' || r.dados.whatsapp === 'sem_numero');
    (tudo ? toast.success : toast.warning)(partes.join('; ') + '.');
  }
  const copiar = (t: string, ok: string) => navigator.clipboard.writeText(t).then(() => toast.success(ok), () => toast.error('Não foi possível copiar.'));

  return (
    <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <p className="font-medium">Senha temporária de {senha.email}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-background px-3 py-1.5 text-base font-semibold tracking-wide">{senha.senha}</code>
        <Botao tipo="secundario" onClick={() => copiar(senha.senha, 'Senha copiada.')}>
          <Copy className="h-4 w-4" aria-hidden /> Copiar senha
        </Botao>
      </div>
      <label className="mt-4 block">
        <span className={ROTULO}>Mensagem pronta para o médico (pode editar antes de mandar)</span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={16} className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed" />
      </label>
      {acesso && !acesso.whatsapp_numero && (
        <label className="mt-3 block max-w-xs">
          <span className={ROTULO}>WhatsApp do médico (opcional, fica no cadastro)</span>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="tel" placeholder="(21) 9 9999-9999" className={CAMPO} />
        </label>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Botao tipo="secundario" onClick={() => copiar(texto, 'Mensagem copiada.')}>
          <Copy className="h-4 w-4" aria-hidden /> Copiar mensagem
        </Botao>
        <Botao ocupado={enviando} desabilitado={!acesso} onClick={() => void enviarPeloSistema()}>
          <Send className="h-4 w-4" aria-hidden /> Enviar pelo sistema
        </Botao>
        <Botao tipo="secundario" onClick={onFechar}>
          Já enviei
        </Botao>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">A senha não fica guardada e não aparece de novo depois que você fechar. O envio sai pelo e-mail da 2B Supply para o e-mail da conta e, se houver número, pelo WhatsApp de avisos. A mensagem já diz o que falta, conforme o cadastro dele.</p>
    </div>
  );
}
