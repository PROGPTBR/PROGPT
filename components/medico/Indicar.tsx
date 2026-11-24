'use client';

import { useState } from 'react';
import { Copy, MessageCircle, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { lerContatos } from '@/lib/medico/agenda';
import { Botao, CAMPO, CARTAO, dataBr, ROTULO, Selo, type PropsDaAba, Info } from './ui';

// Indicar um colega (sub-projeto 109). O médico manda o convite pelo
// WhatsApp DELE (o sistema só abre a conversa com o texto pronto) e registra
// a indicação para a 2B Supply acompanhar. Nada é enviado sozinho ao colega.

const SITUACAO: Record<string, { rotulo: string; cor: 'neutro' | 'azul' | 'verde' | 'amarelo' }> = {
  nova: { rotulo: 'Indicado', cor: 'neutro' },
  em_contato: { rotulo: 'Em contato', cor: 'azul' },
  virou_cliente: { rotulo: 'Já usa', cor: 'verde' },
  sem_interesse: { rotulo: 'Sem interesse', cor: 'amarelo' },
};

function linkDoWhatsapp(contato: string, texto: string): string {
  const numero = contato.replace(/\D/g, '');
  const destino = numero.length === 10 || numero.length === 11 ? `55${numero}` : numero;
  return `https://wa.me/${contato.includes('@') ? '' : destino}?text=${encodeURIComponent(texto)}`;
}

export function Indicar({ estado, enviar }: PropsDaAba) {
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [lista, setLista] = useState('');
  const [salvando, setSalvando] = useState<'um' | 'lista' | null>(null);
  const endereco = typeof window === 'undefined' ? '' : `${window.location.origin}/medicos`;
  const convite = `Estou usando um app que controla as cirurgias, cobra o hospital do que não foi pago e avisa quando o dinheiro cai. Vale conhecer: ${endereco}`;
  const lidos = lerContatos(lista);

  async function salvar(indicacoes: { nome: string; contato: string }[], qual: 'um' | 'lista') {
    setSalvando(qual);
    const r = await enviar<{ novas: number }>('POST', '/indicacoes', { indicacoes });
    setSalvando(null);
    if (!r) return;
    toast.success(r.novas === 0 ? 'Esses colegas já estavam na sua lista.' : r.novas === 1 ? 'Indicação registrada.' : `${r.novas} indicações registradas.`);
    if (qual === 'um') {
      setNome('');
      setContato('');
    } else setLista('');
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-medico-escuro via-medico to-medico-claro p-6 text-white shadow-[0_18px_50px_rgba(10,31,77,0.28)]">
        <UserPlus className="h-8 w-8" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold">Indique um colega</h2>
        <p className="mt-1 max-w-xl text-sm text-white/80">Conhece outro médico que perde tempo conferindo demonstrativo e cobrando hospital? Mande o convite pelo seu WhatsApp.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={linkDoWhatsapp('', convite)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-medico hover:bg-white/90">
            <MessageCircle className="h-4 w-4" aria-hidden /> Enviar pelo WhatsApp
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(convite).then(() => toast.success('Convite copiado.'), () => toast.error('Não foi possível copiar.'))}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/25"
          >
            <Copy className="h-4 w-4" aria-hidden /> Copiar convite
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={CARTAO}>
          <h3 className="text-base font-semibold flex items-center gap-1">Indicar um colega <Info>A indicação fica registrada e a equipe pode procurar o colega para apresentar o app.</Info></h3>
          <div className="mt-3 grid gap-3">
            <label>
              <span className={ROTULO}>Nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={CAMPO} />
            </label>
            <label>
              <span className={ROTULO}>WhatsApp ou e-mail</span>
              <input value={contato} onChange={(e) => setContato(e.target.value)} className={CAMPO} />
            </label>
            <div>
              <Botao ocupado={salvando === 'um'} desabilitado={nome.trim().length < 2 || contato.trim().length < 5} onClick={() => salvar([{ nome, contato }], 'um')}>
                Registrar indicação
              </Botao>
            </div>
          </div>
        </section>

        <section className={CARTAO}>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-medico" aria-hidden /> Colar uma lista de contatos
           <Info>Uma pessoa por linha, com nome e WhatsApp ou e-mail. Serve copiar de uma planilha ou da lista de um grupo.</Info></h3>
          <textarea value={lista} onChange={(e) => setLista(e.target.value)} rows={5} placeholder={'Dra. Marina Lopes, (21) 99999-0000\nDr. Paulo Reis; paulo@clinica.com.br'} className={`${CAMPO} mt-3 h-auto py-2`} aria-label="Lista de contatos" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{lista.trim() ? `${lidos.length} ${lidos.length === 1 ? 'contato reconhecido' : 'contatos reconhecidos'}` : ''}</span>
            <Botao ocupado={salvando === 'lista'} desabilitado={lidos.length === 0} onClick={() => salvar(lidos, 'lista')}>
              Registrar {lidos.length > 0 ? lidos.length : ''} {lidos.length === 1 ? 'indicação' : 'indicações'}
            </Botao>
          </div>
        </section>
      </div>

      {estado.indicacoes.length > 0 && (
        <section className={CARTAO}>
          <h3 className="mb-3 text-base font-semibold">Seus indicados</h3>
          <ul className="divide-y divide-border rounded-2xl border border-border text-sm">
            {estado.indicacoes.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{i.nome}</span> <Selo cor={(SITUACAO[i.situacao] ?? SITUACAO.nova!).cor}>{(SITUACAO[i.situacao] ?? SITUACAO.nova!).rotulo}</Selo>
                  <span className="block text-xs text-muted-foreground">
                    {i.contato} · indicado em {dataBr(i.created_at.slice(0, 10))}
                  </span>
                </span>
                {!i.contato.includes('@') && (
                  <a href={linkDoWhatsapp(i.contato, `Olá, ${i.nome.split(' ')[0]}. ${convite}`)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
                    <MessageCircle className="h-4 w-4" aria-hidden /> Chamar no WhatsApp
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
