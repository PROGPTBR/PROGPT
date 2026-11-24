'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, BellRing, Copy, FileUp, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import { lerExtrato, sugerirPagamentos, type Credito } from '@/lib/medico/extrato';
import { Botao, brl, CAMPO, CARTAO, chamar, dataBr, ROTULO, Selo, type PropsDaAba } from './ui';

// Integrações da Área Médica (sub-projeto 101): WhatsApp, e-mail, avisos fora
// da tela e conferência do extrato do banco.

type Conexao = { estado: 'open' | 'connecting' | 'close'; grupos: { jid: string; nome: string }[]; configurado: boolean };

/** Conecta um WhatsApp por QR code e mostra o estado. `alvo=avisos` é o número da 2B Supply. */
function ConexaoWhatsapp({ alvo, aoConectar }: { alvo: 'medico' | 'avisos'; aoConectar?: () => void }) {
  const [estado, setEstado] = useState<Conexao['estado'] | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const consultar = useCallback(async () => {
    const r = await chamar<Conexao>('GET', `/whatsapp?alvo=${alvo}`);
    if (!r.ok) return;
    setEstado(r.dados.estado);
    if (r.dados.estado === 'open') {
      setQr((antes) => {
        if (antes) aoConectar?.();
        return null;
      });
    }
  }, [alvo, aoConectar]);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  // Com o QR na tela, confere a cada 3 s se o celular já leu.
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(() => void consultar(), 3000);
    return () => clearInterval(t);
  }, [qr, consultar]);

  async function acao(nome: 'conectar' | 'desconectar') {
    if (nome === 'desconectar' && !window.confirm('Desconectar este WhatsApp?')) return;
    setOcupado(true);
    const r = await chamar<{ qr?: string | null }>('POST', '/whatsapp', { acao: nome, alvo });
    setOcupado(false);
    if (!r.ok) return void toast.error(r.mensagem);
    if (nome === 'conectar') setQr(r.dados.qr ?? null);
    else setQr(null);
    await consultar();
    if (nome === 'desconectar') aoConectar?.();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {estado === null ? <Selo>Verificando</Selo> : estado === 'open' ? <Selo cor="verde">Conectado</Selo> : <Selo cor="amarelo">Não conectado</Selo>}
        {estado === 'open' ? (
          <Botao tipo="secundario" ocupado={ocupado} onClick={() => acao('desconectar')}>
            Desconectar
          </Botao>
        ) : (
          <Botao ocupado={ocupado} onClick={() => acao('conectar')}>
            {qr ? 'Gerar outro QR code' : 'Conectar WhatsApp'}
          </Botao>
        )}
      </div>
      {qr && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code para conectar o WhatsApp" className="h-56 w-56 rounded-xl border border-border bg-white p-2" />
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Abra o WhatsApp no celular.</li>
            <li>Toque em Mais opções (ou Configurações) e em Dispositivos conectados.</li>
            <li>Toque em Conectar um dispositivo e aponte para este código.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

export function Integracoes({ estado, hoje, enviar, recarregar }: PropsDaAba) {
  const { integracoes, config } = estado;
  const [form, setForm] = useState({
    medico_email: config.medico_email,
    whatsapp_numero: config.whatsapp_numero,
    chave_pix: config.chave_pix,
    avisos_email: config.avisos_email,
    avisos_whatsapp: config.avisos_whatsapp,
  });
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [grupos, setGrupos] = useState<Conexao['grupos'] | null>(null);
  const [carregandoGrupos, setCarregandoGrupos] = useState(false);

  async function salvar() {
    setSalvando(true);
    await enviar('PUT', '/config', form, 'Dados salvos.');
    setSalvando(false);
  }

  const carregarGrupos = useCallback(async () => {
    setCarregandoGrupos(true);
    const r = await chamar<Conexao>('GET', '/whatsapp?alvo=medico&grupos=1');
    setCarregandoGrupos(false);
    if (!r.ok) return void toast.error(r.mensagem);
    if (r.dados.estado !== 'open') return void setGrupos(null);
    setGrupos(r.dados.grupos);
    if (r.dados.grupos.length === 0) toast.error('Não encontrei grupos nesse WhatsApp. Tente de novo em instantes.');
  }, []);

  async function escolherGrupo(jid: string) {
    const nome = grupos?.find((g) => g.jid === jid)?.nome ?? '';
    await enviar('POST', '/whatsapp', { acao: 'grupo', jid, nome }, jid ? `Lendo o grupo "${nome}".` : 'Leitura do grupo desligada.');
  }

  async function testarAviso() {
    setTestando(true);
    const r = await chamar<{ email: boolean; whatsapp: boolean }>('POST', '/avisos');
    setTestando(false);
    if (!r.ok) return void toast.error(r.mensagem);
    const canais = [r.dados.email && 'e-mail', r.dados.whatsapp && 'WhatsApp'].filter(Boolean).join(' e ');
    toast.success(`Aviso enviado por ${canais}.`);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={CARTAO}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessageCircle className="h-5 w-5 text-brand" aria-hidden /> Seu WhatsApp
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Conecte o seu número para o sistema ler sozinho o grupo onde as cirurgias são avisadas e para mandar a cobrança ao paciente. Só as mensagens de texto do grupo escolhido são guardadas; conversas particulares e outros grupos não são lidos.
        </p>
        {!integracoes.whatsapp ? (
          <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">O WhatsApp ainda não foi ligado no servidor. Fale com a 2B Supply.</p>
        ) : (
          <div className="mt-3 space-y-4">
            <ConexaoWhatsapp alvo="medico" aoConectar={() => void recarregar()} />
            <div>
              <span className={ROTULO}>Grupo das cirurgias</span>
              <div className="flex flex-wrap items-center gap-2">
                {grupos ? (
                  <select value={config.grupo_jid} onChange={(e) => void escolherGrupo(e.target.value)} className={`${CAMPO} w-auto max-w-full`} aria-label="Grupo das cirurgias">
                    <option value="">Nenhum (não ler grupo)</option>
                    {grupos.map((g) => (
                      <option key={g.jid} value={g.jid}>
                        {g.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm">{config.grupo_nome || 'Nenhum grupo escolhido'}</span>
                )}
                <Botao tipo="secundario" ocupado={carregandoGrupos} onClick={carregarGrupos}>
                  {grupos ? 'Atualizar lista' : 'Escolher grupo'}
                </Botao>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">As mensagens novas aparecem na aba Cirurgias para você conferir antes de salvar.</p>
            </div>
          </div>
        )}
      </section>

      <section className={CARTAO}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <BellRing className="h-5 w-5 text-brand" aria-hidden /> Avisos fora da tela
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Toda manhã, se houver algo parado (nota para pedir, nota para enviar, pagamento atrasado, cirurgia sem pagamento), você recebe um resumo. O aviso não leva nome de paciente.
        </p>
        <div className="mt-3 grid gap-3">
          <label>
            <span className={ROTULO}>WhatsApp que recebe os avisos</span>
            <input value={form.whatsapp_numero} onChange={(e) => setForm({ ...form, whatsapp_numero: e.target.value })} placeholder="(21) 99999-9999" inputMode="tel" className={CAMPO} />
          </label>
          <label>
            <span className={ROTULO}>Seu e-mail (recebe os avisos e as respostas do contador e do hospital)</span>
            <input type="email" value={form.medico_email} onChange={(e) => setForm({ ...form, medico_email: e.target.value })} className={CAMPO} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.avisos_whatsapp} onChange={(e) => setForm({ ...form, avisos_whatsapp: e.target.checked })} /> Avisar por WhatsApp
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.avisos_email} onChange={(e) => setForm({ ...form, avisos_email: e.target.checked })} /> Avisar por e-mail
          </label>
          <label>
            <span className={ROTULO}>Sua chave Pix (vai na cobrança ao paciente)</span>
            <input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} className={CAMPO} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Botao ocupado={salvando} onClick={salvar}>
              Salvar
            </Botao>
            <Botao tipo="secundario" ocupado={testando} onClick={testarAviso} titulo="Envia agora o resumo de hoje, com os dados já salvos">
              Enviar aviso de teste
            </Botao>
          </div>
        </div>
        {integracoes.super_admin && integracoes.whatsapp && (
          <div className="mt-4 rounded-xl border border-dashed border-border p-3">
            <p className="text-sm font-medium">Número que envia os avisos (2B Supply)</p>
            <p className="mb-2 text-xs text-muted-foreground">Só a equipe da 2B Supply vê este quadro. É um número da empresa, conectado uma vez, que manda o aviso para todos os médicos.</p>
            <ConexaoWhatsapp alvo="avisos" />
          </div>
        )}
      </section>

      <section className={CARTAO}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Mail className="h-5 w-5 text-brand" aria-hidden /> E-mail
        </h2>
        <div className="mt-2 space-y-3 text-sm">
          <div>
            <p className="font-medium">Envio automático {integracoes.email_envio ? <Selo cor="verde">Ligado</Selo> : <Selo cor="amarelo">Desligado no servidor</Selo>}</p>
            <p className="mt-0.5 text-muted-foreground">
              O pedido de nota ao contador, a nota ao hospital e a cobrança saem pelo sistema com um clique. A resposta volta para o seu e-mail e você recebe cópia do que foi enviado.
            </p>
          </div>
          <div>
            <p className="font-medium">Recebimento automático {integracoes.email_entrada ? <Selo cor="verde">Ligado</Selo> : <Selo cor="amarelo">Desligado no servidor</Selo>}</p>
            {integracoes.email_entrada ? (
              <>
                <p className="mt-0.5 text-muted-foreground">
                  No seu e-mail, crie um encaminhamento automático dos e-mails dos hospitais para o endereço abaixo. Cada demonstrativo que chegar aparece na aba Demonstrativos, já lido, para você conferir.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 break-all rounded-lg bg-muted px-2 py-1 text-xs">{integracoes.email_entrada}</code>
                  <Botao
                    tipo="secundario"
                    onClick={() => navigator.clipboard.writeText(integracoes.email_entrada!).then(() => toast.success('Endereço copiado.'), () => toast.error('Não foi possível copiar.'))}
                  >
                    <Copy className="h-4 w-4" aria-hidden /> Copiar
                  </Botao>
                </div>
              </>
            ) : (
              <p className="mt-0.5 text-muted-foreground">Enquanto isso, cole o texto do e-mail ou importe o arquivo em &quot;Novo demonstrativo&quot;.</p>
            )}
          </div>
        </div>
      </section>

      <Banco estado={estado} hoje={hoje} enviar={enviar} recarregar={recarregar} />
    </div>
  );
}

function Banco({ estado, enviar }: PropsDaAba) {
  const [creditos, setCreditos] = useState<Credito[] | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const sugestoes = useMemo(() => (creditos ? sugerirPagamentos(creditos, estado.demonstrativos, estado.hospitais) : []), [creditos, estado]);

  async function abrir(arquivo: File | undefined) {
    if (!arquivo) return;
    const lidos = lerExtrato(await arquivo.text());
    if (lidos.length === 0) return void toast.error('Não encontrei créditos nesse arquivo. Exporte o extrato em OFX ou CSV.');
    setCreditos(lidos);
  }

  return (
    <section className={CARTAO}>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Banknote className="h-5 w-5 text-brand" aria-hidden /> Banco
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Exporte o extrato da conta (OFX ou CSV) e o sistema acha os depósitos que pagam as notas em aberto. Nada é marcado sem você confirmar. O arquivo é lido no seu navegador e não é guardado.
      </p>
      <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
        <FileUp className="h-4 w-4" aria-hidden /> Conferir extrato
        <input type="file" accept=".ofx,.csv,.txt" className="hidden" onChange={(e) => void abrir(e.target.files?.[0])} />
      </label>

      {creditos && (
        <div className="mt-3 text-sm">
          <p className="text-muted-foreground">
            {creditos.length} {creditos.length === 1 ? 'crédito lido' : 'créditos lidos'}.{' '}
            {sugestoes.length === 0 ? 'Nenhum bate com as notas em aberto.' : `${sugestoes.length} ${sugestoes.length === 1 ? 'pagamento encontrado' : 'pagamentos encontrados'}:`}
          </p>
          <ul className="mt-2 space-y-2">
            {sugestoes.map((s) => {
              const d = estado.demonstrativos.find((x) => x.id === s.demonstrativo_id)!;
              const quem = d.tipo === 'direto' ? d.pagador_nome : estado.hospitais.find((h) => h.id === d.hospital_id)?.nome;
              return (
                <li key={s.demonstrativo_id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {quem}
                        {d.nota_numero && `, nota ${d.nota_numero}`} <Selo cor={s.confianca === 'certa' ? 'verde' : 'amarelo'}>{s.confianca === 'certa' ? 'Valor igual' : 'Provável'}</Selo>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Crédito de {brl(s.credito.valor)} em {dataBr(s.credito.data)}: {s.credito.descricao || 'sem descrição'}
                        {s.diferenca > 0 && `. Veio ${brl(s.diferenca)} a menos que a nota (${brl(d.valor_total)}).`}
                      </p>
                    </div>
                    <Botao
                      ocupado={confirmando === d.id}
                      onClick={async () => {
                        setConfirmando(d.id);
                        await enviar('PATCH', `/demonstrativos/${d.id}`, { pago_em: s.credito.data, valor_pago: s.credito.valor, ...(d.nota_enviada_em ? {} : { nota_enviada_em: s.credito.data }) }, 'Pagamento confirmado.');
                        setConfirmando(null);
                      }}
                    >
                      Confirmar pagamento
                    </Botao>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Ligação direta com o BTG Empresas: o banco tem a abertura (extrato e aviso de crédito em conta, com a sua autorização). Ela depende do cadastro do aplicativo da 2B Supply no BTG; quando for liberado, o pagamento passa a ser marcado sozinho.
      </p>
    </section>
  );
}
