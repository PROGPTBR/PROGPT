'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

import { ConexaoWhatsapp } from '@/components/medico/Integracoes';
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
};
type IndicacaoAdmin = { id: string; nome: string; contato: string; situacao: string; created_at: string; indicado_por: string };
type Dados = { acessos: Acesso[]; indicacoes: IndicacaoAdmin[]; avisos: { whatsapp: string | null; email: boolean; btg: boolean } };

export function AreaMedicaAdmin() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState<'medico' | 'equipe'>('medico');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [senha, setSenha] = useState<{ email: string; senha: string } | null>(null);

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
    const r = await chamar<{ convidado: boolean; senha: string | null }>('POST', '/acessos', { email: para, tipo: comoTipo, modo });
    setOcupado(null);
    if (!r.ok) return void toast.error(r.mensagem);
    if (r.dados.senha) setSenha({ email: para.trim().toLowerCase(), senha: r.dados.senha });
    else toast.success(r.dados.convidado ? 'Convite enviado por e-mail: a pessoa cria a senha e entra.' : 'Acesso liberado para a conta que já existia.');
    setEmail('');
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
        {senha && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium">Senha temporária de {senha.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-background px-3 py-1.5 text-base font-semibold tracking-wide">{senha.senha}</code>
              <Botao tipo="secundario" onClick={() => navigator.clipboard.writeText(senha.senha).then(() => toast.success('Senha copiada.'), () => toast.error('Não foi possível copiar.'))}>
                <Copy className="h-4 w-4" aria-hidden /> Copiar
              </Botao>
              <Botao tipo="secundario" onClick={() => setSenha(null)}>
                Já anotei
              </Botao>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Ela não fica guardada e não aparece de novo. O médico entra em /medicos e o sistema pede para ele criar a própria senha.</p>
          </div>
        )}
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
                  <tr key={a.id}>
                    <td className={TD}>
                      <span className="font-medium">{a.nome || a.email}</span> <Selo cor={a.tipo === 'medico' ? 'azul' : 'neutro'}>{a.tipo === 'medico' ? 'Médico' : 'Equipe'}</Selo>
                      {a.nome && <span className="block break-all text-xs text-muted-foreground">{a.email}</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{entrou(a.ultimo_acesso)}</td>
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
                      <button type="button" onClick={() => void remover(a)} className="text-muted-foreground hover:text-red-600">
                        Tirar acesso
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Os números não contam os dados de exemplo. Verde em WhatsApp = o médico escolheu o grupo das cirurgias; em Banco = ligou a conta.</p>
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
