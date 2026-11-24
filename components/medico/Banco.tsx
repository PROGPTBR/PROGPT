'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Banknote, FileUp, Landmark } from 'lucide-react';
import { toast } from 'sonner';

import { lerExtrato, sugerirPagamentos, type Credito, type Sugestao } from '@/lib/medico/extrato';
import type { EstadoMedico, MovimentoBanco } from '@/lib/medico/types';
import { Botao, brl, CAMPO, CARTAO, chamar, dataBr, ROTULO, Selo, TD, TH, type PropsDaAba, Info } from './ui';

// Banco (sub-projeto 102): a conta do BTG ligada, o que entrou e o que saiu, e
// os créditos que pagam as notas em aberto. Sem a ligação direta, o médico
// confere pelo arquivo do extrato.

function diaDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function cnpjFormatado(c: string): string {
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function quemPaga(estado: EstadoMedico, demonstrativoId: string): string {
  const d = estado.demonstrativos.find((x) => x.id === demonstrativoId);
  if (!d) return '';
  const nome = d.tipo === 'direto' ? d.pagador_nome : (estado.hospitais.find((h) => h.id === d.hospital_id)?.nome ?? '');
  return `${nome}${d.nota_numero ? `, nota ${d.nota_numero}` : ''}`;
}

export function Banco({ estado, hoje, enviar }: PropsDaAba) {
  const { conta, movimentos, integracoes } = estado;
  const [cnpj, setCnpj] = useState('');
  const [indo, setIndo] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [doArquivo, setDoArquivo] = useState<Credito[] | null>(null);

  const mes = hoje.slice(0, 7);
  const doMes = movimentos.filter((m) => diaDe(m.data).startsWith(mes));
  const entrou = doMes.filter((m) => m.sentido === 'entrada').reduce((s, m) => s + m.valor, 0);
  const saiu = doMes.filter((m) => m.sentido === 'saida').reduce((s, m) => s + m.valor, 0);

  // Créditos do banco ainda sem nota: o sistema sugere qual nota cada um paga.
  const soltos = useMemo(() => movimentos.filter((m) => m.sentido === 'entrada' && !m.demonstrativo_id), [movimentos]);
  const sugestoesDoBanco = useMemo(() => {
    const creditos = soltos.map((m) => ({ m, c: { data: diaDe(m.data), valor: m.valor, descricao: `${m.descricao} ${m.contraparte}`.trim() } }));
    return sugerirPagamentos(creditos.map((x) => x.c), estado.demonstrativos, estado.hospitais).map((s) => ({ s, m: creditos.find((x) => x.c === s.credito)!.m }));
  }, [soltos, estado]);
  const sugestoesDoArquivo = useMemo(() => (doArquivo ? sugerirPagamentos(doArquivo, estado.demonstrativos, estado.hospitais) : []), [doArquivo, estado]);

  async function conectar() {
    setIndo(true);
    const r = await chamar<{ url: string }>('GET', `/btg/conectar?cnpj=${encodeURIComponent(cnpj)}`);
    if (!r.ok) {
      setIndo(false);
      return void toast.error(r.mensagem);
    }
    window.location.href = r.dados.url;
  }

  async function confirmar(s: Sugestao, movimento?: MovimentoBanco) {
    const d = estado.demonstrativos.find((x) => x.id === s.demonstrativo_id)!;
    setConfirmando(d.id);
    const ok = await enviar('PATCH', `/demonstrativos/${d.id}`, { pago_em: s.credito.data, valor_pago: s.credito.valor, ...(d.nota_enviada_em ? {} : { nota_enviada_em: s.credito.data }) }, 'Pagamento confirmado.');
    if (ok && movimento) await enviar('PATCH', '/btg', { movimento_id: movimento.id, demonstrativo_id: d.id });
    setConfirmando(null);
  }

  async function abrirArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    const lidos = lerExtrato(await arquivo.text());
    if (lidos.length === 0) return void toast.error('Não encontrei créditos nesse arquivo. Exporte o extrato em OFX ou CSV.');
    setDoArquivo(lidos);
  }

  const listaDeSugestoes = (itens: { s: Sugestao; m?: MovimentoBanco }[]) => (
    <ul className="mt-2 space-y-2">
      {itens.map(({ s, m }) => {
        const d = estado.demonstrativos.find((x) => x.id === s.demonstrativo_id)!;
        return (
          <li key={`${s.demonstrativo_id}-${m?.id ?? 'arquivo'}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {quemPaga(estado, d.id)} <Selo cor={s.confianca === 'certa' ? 'verde' : 'amarelo'}>{s.confianca === 'certa' ? 'Valor igual' : 'Provável'}</Selo>
              </p>
              <p className="text-xs text-muted-foreground">
                Crédito de {brl(s.credito.valor)} em {dataBr(s.credito.data)}: {s.credito.descricao || 'sem descrição'}
                {s.diferenca > 0 && `. Veio ${brl(s.diferenca)} a menos que a nota (${brl(d.valor_total)}).`}
              </p>
            </div>
            <Botao ocupado={confirmando === d.id} onClick={() => confirmar(s, m)}>
              Confirmar pagamento
            </Botao>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-5">
      <section className={CARTAO}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Landmark className="h-5 w-5 text-medico" aria-hidden /> Conta no BTG Empresas
        </h2>
        {conta ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              {conta.erro ? <Selo cor="vermelho">Precisa conectar de novo</Selo> : <Selo cor="verde">Ligada</Selo>} <span className="ml-1">CNPJ {cnpjFormatado(conta.cnpj)}</span>
              <span className="text-muted-foreground"> · desde {dataBr(diaDe(conta.conectado_em))}</span>
              {conta.erro && <span className="mt-1 block text-red-700 dark:text-red-300">{conta.erro}</span>}
            </p>
            <Botao
              tipo="secundario"
              onClick={() => {
                if (window.confirm('Desligar a conta do BTG? Os movimentos já registrados continuam aqui.')) void enviar('DELETE', '/btg', undefined, 'Conta desligada.');
              }}
            >
              Desligar
            </Botao>
          </div>
        ) : !integracoes.btg ? (
          <p className="mt-2 text-sm text-muted-foreground">
            A ligação direta com o BTG está pronta e aguarda a liberação do aplicativo da 2B Supply pelo banco. Enquanto isso, confira os pagamentos pelo arquivo do extrato, logo abaixo.
          </p>
        ) : (
          <div className="mt-2 text-sm">
            <p className="text-muted-foreground">
              Você entra com o seu login do BTG e autoriza a <strong>leitura</strong> da conta. O sistema passa a receber cada crédito e débito na hora, marca sozinho o pagamento das notas e mostra o que entrou e saiu. Ele não movimenta a conta e não vê a sua senha.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label>
                <span className={ROTULO}>CNPJ da conta no BTG</span>
                <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric" className={`${CAMPO} w-56`} />
              </label>
              <Botao ocupado={indo} desabilitado={cnpj.replace(/\D/g, '').length !== 14} onClick={conectar}>
                Conectar BTG
              </Botao>
            </div>
          </div>
        )}
      </section>

      {(conta || movimentos.length > 0) && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { rotulo: 'Entrou neste mês', valor: entrou, icone: ArrowDownLeft, cor: 'text-emerald-700 dark:text-emerald-300' },
              { rotulo: 'Saiu neste mês', valor: saiu, icone: ArrowUpRight, cor: 'text-red-700 dark:text-red-300' },
              { rotulo: 'Resultado do mês', valor: entrou - saiu, icone: Banknote, cor: entrou - saiu < 0 ? 'text-red-700 dark:text-red-300' : '' },
            ].map((k) => (
              <div key={k.rotulo} className={CARTAO}>
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  {k.rotulo} <k.icone className="h-4 w-4" aria-hidden />
                </div>
                <div className={`mt-2 text-2xl font-semibold ${k.cor}`}>{brl(k.valor)}</div>
              </div>
            ))}
          </div>

          {sugestoesDoBanco.length > 0 && (
            <section className={CARTAO}>
              <h2 className="text-base font-semibold">Créditos que parecem pagar notas em aberto <Info>Quando o valor é igual ao da nota, o sistema marca sozinho. Estes vieram com valor diferente (imposto retido, por exemplo) e esperam a sua confirmação.</Info></h2>
              {listaDeSugestoes(sugestoesDoBanco)}
            </section>
          )}

          <section className={CARTAO}>
            <h2 className="text-base font-semibold flex items-center gap-1">Movimentos da conta</h2>
            {movimentos.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhum movimento ainda. Eles aparecem aqui assim que o banco avisar o primeiro crédito ou débito.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className={TH}>Data</th>
                      <th className={TH}>Descrição</th>
                      <th className={TH}>Forma</th>
                      <th className={`${TH} text-right`}>Valor</th>
                      <th className={TH}>Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {movimentos.map((m) => (
                      <tr key={m.id}>
                        <td className={`${TD} whitespace-nowrap`}>{dataBr(diaDe(m.data))}</td>
                        <td className={`${TD} min-w-[14rem]`}>
                          {m.descricao || m.contraparte || 'Sem descrição'}
                          {m.contraparte && m.descricao && !m.descricao.includes(m.contraparte) && <span className="block text-xs text-muted-foreground">{m.contraparte}</span>}
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>{m.forma}</td>
                        <td className={`${TD} whitespace-nowrap text-right font-medium ${m.sentido === 'entrada' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                          {m.sentido === 'entrada' ? '+' : '-'} {brl(m.valor)}
                        </td>
                        <td className={TD}>{m.demonstrativo_id ? <Selo cor="verde">{quemPaga(estado, m.demonstrativo_id) || 'Nota paga'}</Selo> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <section className={CARTAO}>
        <h2 className="text-base font-semibold">Conferir pelo arquivo do extrato <Info>Serve para qualquer banco: exporte o extrato (OFX ou CSV) e o sistema acha os depósitos que pagam as notas em aberto. Nada é marcado sem você confirmar. O arquivo é lido no seu navegador e não é guardado.</Info></h2>
        <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
          <FileUp className="h-4 w-4" aria-hidden /> Conferir extrato
          <input type="file" accept=".ofx,.csv,.txt" className="hidden" onChange={(e) => void abrirArquivo(e.target.files?.[0])} />
        </label>
        {doArquivo && (
          <div className="mt-3 text-sm">
            <p className="text-muted-foreground">
              {doArquivo.length} {doArquivo.length === 1 ? 'crédito lido' : 'créditos lidos'}.{' '}
              {sugestoesDoArquivo.length === 0 ? 'Nenhum bate com as notas em aberto.' : `${sugestoesDoArquivo.length} ${sugestoesDoArquivo.length === 1 ? 'pagamento encontrado' : 'pagamentos encontrados'}:`}
            </p>
            {listaDeSugestoes(sugestoesDoArquivo.map((s) => ({ s })))}
          </div>
        )}
      </section>
    </div>
  );
}
