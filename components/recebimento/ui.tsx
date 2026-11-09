'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import type { SaldoItem } from '@/lib/recebimento/conferencia';
import { STATUS_LABEL, type Apontamento, type FinalidadeNota, type StatusPedido } from '@/lib/recebimento/types';

// Peças compartilhadas do Recebimento de NF (sub-projeto 95): tela do
// comprador e as páginas por link (fornecedor, almoxarifado, financeiro).

export const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3 h-10 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export { brl, dataHora, qtd } from '@/lib/recebimento/formato';
import { qtd } from '@/lib/recebimento/formato';

const STATUS_COR: Record<StatusPedido, string> = {
  aguardando_nota: 'bg-muted text-muted-foreground',
  aguardando_entrega: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  parcial: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  aguardando_ok: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  pagamento_liberado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelado: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

export function StatusBadge({ status }: { status: StatusPedido }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_COR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const FINALIDADE_CURTA: Record<FinalidadeNota, string> = {
  entrega: 'Entrega',
  financeira: 'Financeira',
  unica: 'Entrega e financeira',
};

export function FinalidadeBadge({ finalidade }: { finalidade: FinalidadeNota }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
      {FINALIDADE_CURTA[finalidade]}
    </span>
  );
}

export function Apontamentos({ itens, vazio = 'A nota bate com o pedido.' }: { itens: Apontamento[]; vazio?: string }) {
  if (itens.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> {vazio}
      </p>
    );
  }
  const ordem = { alta: 0, media: 1, info: 2 } as const;
  return (
    <ul className="space-y-1.5">
      {[...itens]
        .sort((a, b) => ordem[a.severidade] - ordem[b.severidade])
        .map((a, i) => (
          <li
            key={i}
            className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
              a.severidade === 'alta'
                ? 'bg-red-500/10 text-red-800 dark:text-red-200'
                : a.severidade === 'media'
                  ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200'
                  : 'bg-muted/60 text-muted-foreground'
            }`}
          >
            {a.severidade === 'info' ? (
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0">{a.mensagem}</span>
          </li>
        ))}
    </ul>
  );
}

/** Saldo do recebimento físico. Sem valores: serve também ao almoxarifado. */
export function TabelaSaldo({ saldo }: { saldo: SaldoItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Pedido</th>
            <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Recebido</th>
            <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Pendente</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {saldo.map((s) => (
            <tr key={s.item}>
              <td className="px-3 py-2 min-w-[12rem]">
                <div>{s.descricao}</div>
                {s.ressalvas.length > 0 && (
                  <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">Ressalva: {s.ressalvas.join('; ')}</div>
                )}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {qtd(s.pedida)} {s.unidade}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">{qtd(s.recebida)}</td>
              <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${s.pendente > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {s.pendente > 0 ? qtd(s.pendente) : 'ok'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ACEITA_NOTA =
  /\.(xml|pdf|png|jpe?g)$/i;
const MIME_NOTA = new Set([
  'text/xml',
  'application/xml',
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

function arquivoDeNota(file: File): boolean {
  return ACEITA_NOTA.test(file.name) || MIME_NOTA.has(file.type);
}

/** Envio do arquivo da nota (XML, PDF ou foto). Usado pelo comprador e pelo
 *  fornecedor; cada um passa a sua rota. Arrastar o arquivo vale tanto quanto
 *  abrir o seletor — o fornecedor não precisa procurar a nota na pasta. */
export function EnvioNota({
  endpoint,
  onEnviada,
  textoBotao = 'Escolher arquivo',
}: {
  endpoint: string;
  onEnviada: (r: { numero?: string; finalidade?: FinalidadeNota }) => void;
  textoBotao?: string;
}) {
  const [finalidade, setFinalidade] = useState<FinalidadeNota | 'auto'>('auto');
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviar(file: File) {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('finalidade', finalidade);
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? 'Não foi possível enviar a nota.');
        return;
      }
      onEnviada({ numero: data.numero ?? data.nota?.numero, finalidade: data.finalidade ?? data.nota?.finalidade });
    } catch {
      toast.error('Sem conexão. Tente de novo.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function receber(file: File | undefined) {
    if (!file || enviando) return;
    if (!arquivoDeNota(file)) {
      toast.error('Envie o XML da nota, o PDF do DANFE ou uma foto (PNG ou JPG).');
      return;
    }
    void enviar(file);
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Esta nota é</span>
        <select className={CAMPO} value={finalidade} onChange={(e) => setFinalidade(e.target.value as FinalidadeNota | 'auto')}>
          <option value="auto">Identificar pela nota (pelo CFOP)</option>
          <option value="unica">Nota única: material e faturamento</option>
          <option value="entrega">Nota de entrega (remessa do material)</option>
          <option value="financeira">Nota financeira (faturamento, sem material)</option>
        </select>
      </label>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,.pdf,.png,.jpg,.jpeg,text/xml,application/xml,application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          receber(e.target.files?.[0]);
        }}
      />
      <div
        data-testid="envio-nota-dropzone"
        onDragEnter={(e) => {
          if (!e.dataTransfer?.types?.includes('Files')) return;
          e.preventDefault();
          setArrastando(true);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer?.types?.includes('Files')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setArrastando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (e.dataTransfer.files.length > 1) {
            toast.info('Envie uma nota por vez. Usamos o primeiro arquivo.');
          }
          receber(e.dataTransfer.files[0]);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          arrastando ? 'border-brand bg-brand/10' : 'border-border bg-background'
        } ${enviando ? 'pointer-events-none opacity-70' : ''}`}
      >
        {enviando ? (
          <Loader2 className="h-7 w-7 animate-spin text-brand" aria-hidden />
        ) : (
          <FileUp className="h-7 w-7 text-muted-foreground" aria-hidden />
        )}
        <p className="text-sm font-medium">
          {enviando ? 'Lendo a nota…' : arrastando ? 'Solte a nota aqui' : 'Arraste a nota aqui'}
        </p>
        <p className="text-xs text-muted-foreground">XML da NF-e, PDF do DANFE ou foto — sem abrir a pasta</p>
        <button
          type="button"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-brand-gradient text-black h-10 px-4 text-sm font-semibold disabled:opacity-60"
        >
          {textoBotao}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Prefira o XML da NF-e: é lido na hora e sem erro. PDF do DANFE ou foto também funcionam, lidos pela IA.
      </p>
    </div>
  );
}
