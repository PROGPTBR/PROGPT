'use client';

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Download, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { semTravessao } from '@/lib/texto/sem-travessao';
import {
  NIVEL_LABEL,
  corDaCategoria,
  csvFornecedores,
  type FornecedorMapa,
  type Plano,
} from '@/lib/mapa-fornecedores/tipos';
import { MapaLeaflet } from './MapaLeaflet';

// Resultado do Mapa de Fornecedores: plano de categorias (legenda e filtro),
// mapa, lista e relatório. Usado ao vivo (enquanto as buscas chegam) e no
// Histórico.

type Props = {
  plano: Plano | null;
  fornecedores: FornecedorMapa[];
  relatorio: string;
  runId: string | null;
  /** Categorias cuja busca ainda não voltou (mostra "buscando…" na legenda). */
  pendentes?: ReadonlySet<string>;
  localizando?: boolean;
  escrevendo?: boolean;
};

function baixar(nome: string, conteudo: Blob) {
  const url = URL.createObjectURL(conteudo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function MapaResultado({ plano, fornecedores, relatorio, runId, pendentes, localizando, escrevendo }: Props) {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [baixandoWord, setBaixandoWord] = useState(false);

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of fornecedores) m.set(f.categoria, (m.get(f.categoria) ?? 0) + 1);
    return m;
  }, [fornecedores]);
  const lista = categoria ? fornecedores.filter((f) => f.categoria === categoria) : fornecedores;
  const noMapa = fornecedores.filter((f) => f.lat != null).length;
  const aproximados = fornecedores.filter((f) => f.precisao === 'cidade').length;
  const centro = useMemo(() => {
    const p = fornecedores.find((f) => f.lat != null && f.precisao === 'endereco');
    return p ? { lat: p.lat!, lng: p.lng! } : undefined;
  }, [fornecedores]);

  async function baixarWord() {
    if (!runId) return;
    setBaixandoWord(true);
    try {
      const res = await fetch(`/api/assistants/runs/${runId}/docx`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      baixar(`mapa-fornecedores-${runId.slice(0, 8)}.docx`, await res.blob());
    } catch (err) {
      toast.error('Falha ao baixar o Word', { description: String(err) });
    } finally {
      setBaixandoWord(false);
    }
  }

  return (
    <div className="space-y-5">
      {plano && (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <div>
            <h2 className="text-base font-semibold">
              {plano.empresa} <span className="font-normal text-muted-foreground">· {plano.cidade}/{plano.uf}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{semTravessao(plano.leitura)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoria(null)}
              className={`rounded-full border px-3 py-1 text-xs ${categoria === null ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            >
              Todas ({fornecedores.length})
            </button>
            {plano.categorias.map((c) => {
              const ativo = categoria === c.nome;
              const buscando = pendentes?.has(c.nome);
              return (
                <button
                  key={c.nome}
                  type="button"
                  onClick={() => setCategoria(ativo ? null : c.nome)}
                  title={`${c.tipo} · criticidade ${NIVEL_LABEL[c.criticidade]} · concorrência ${NIVEL_LABEL[c.concorrencia]}. ${c.porque}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${ativo ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: corDaCategoria(plano, c.nome) }} />
                  {c.nome}
                  <span className="text-muted-foreground">
                    {c.tipo} · {buscando ? 'buscando…' : contagem.get(c.nome) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {fornecedores.length > 0 && (
        <>
          <MapaLeaflet fornecedores={fornecedores} plano={plano} categoria={categoria} centro={centro} />
          <p className="-mt-3 text-xs text-muted-foreground">
            {localizando
              ? 'Localizando os endereços no mapa…'
              : `${noMapa} de ${fornecedores.length} fornecedores no mapa${aproximados ? `, ${aproximados} com local aproximado (borda tracejada)` : ''}. Clique num ponto para ver os dados.`}
          </p>

          <section className="rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <h3 className="text-sm font-semibold">
                {categoria ?? 'Todos os fornecedores'} ({lista.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!plano}
                  onClick={() =>
                    plano &&
                    baixar(
                      'mapa-fornecedores.csv',
                      new Blob([csvFornecedores({ plano, fornecedores })], { type: 'text/csv;charset=utf-8' }),
                    )
                  }
                >
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Baixar planilha
                </Button>
                <Button variant="outline" size="sm" disabled={!runId || escrevendo || baixandoWord} onClick={baixarWord}>
                  <Download className="mr-1 h-3.5 w-3.5" /> {baixandoWord ? 'Baixando…' : 'Baixar relatório (Word)'}
                </Button>
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-2 font-medium">Fornecedor</th>
                    <th className="px-4 py-2 font-medium">Categoria</th>
                    <th className="px-4 py-2 font-medium">Contato</th>
                    <th className="px-4 py-2 font-medium">Local</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((f) => (
                    <tr key={f.id || f.nome} className="border-b align-top last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium">{f.nome}</div>
                        {f.oQueVende && <div className="text-xs text-muted-foreground">{f.oQueVende}</div>}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: corDaCategoria(plano, f.categoria) }} />
                          {f.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {f.telefone && <div className="whitespace-nowrap">{f.telefone}</div>}
                        {f.site && (
                          <a href={f.site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            site <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {[f.endereco, f.bairro].filter(Boolean).join(', ')}
                        {(f.cidade || f.uf) && <div>{[f.cidade, f.uf].filter(Boolean).join('/')}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {(relatorio || escrevendo) && (
        <article className="prose prose-sm max-w-none overflow-x-auto rounded-2xl border bg-card p-6 dark:prose-invert [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_td]:px-2 [&_th]:px-2">
          {relatorio ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{semTravessao(relatorio)}</ReactMarkdown>
          ) : (
            <p className="italic text-muted-foreground">Escrevendo a análise…</p>
          )}
        </article>
      )}
    </div>
  );
}
