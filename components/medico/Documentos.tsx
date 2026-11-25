'use client';

import { useRef, useState } from 'react';
import { Camera, Download, FileText, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { TIPO_DE_DOCUMENTO_LABEL, TIPOS_DE_DOCUMENTO, type Documento, type TipoDeDocumento } from '@/lib/medico/types';
import { Botao, CAMPO, CARTAO, dataBr, type PropsDaAba, Info } from './ui';

// Documentos do médico (sub-projeto 108): nota fiscal, demonstrativo,
// comprovante e o que mais ele quiser guardar. Dá para escolher o arquivo,
// arrastar ou, no celular, tirar a foto na hora.

const ACEITA = '.pdf,.xml,.xlsx,.xls,.docx,.csv,image/*';

function tamanho(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function enviarArquivos(arquivos: File[], tipo: TipoDeDocumento, demonstrativoId: string | null): Promise<number> {
  let ok = 0;
  for (const arquivo of arquivos) {
    const fd = new FormData();
    fd.set('arquivo', arquivo);
    fd.set('tipo', tipo);
    if (demonstrativoId) fd.set('demonstrativo_id', demonstrativoId);
    try {
      const res = await fetch('/api/medico/documentos', { method: 'POST', body: fd });
      const dados = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.ok) ok += 1;
      else toast.error(`${arquivo.name}: ${dados.message ?? 'não foi possível guardar.'}`);
    } catch {
      toast.error(`${arquivo.name}: sem conexão.`);
    }
  }
  return ok;
}

/** Botões de anexar: escolher arquivo, tirar foto (celular) e a área de soltar. */
export function Anexar({
  recarregar,
  demonstrativoId = null,
  tipoInicial = 'outro',
  compacto = false,
}: Pick<PropsDaAba, 'recarregar'> & { demonstrativoId?: string | null; tipoInicial?: TipoDeDocumento; compacto?: boolean }) {
  const [tipo, setTipo] = useState<TipoDeDocumento>(tipoInicial);
  const [enviando, setEnviando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  async function receber(lista: FileList | null) {
    const arquivos = [...(lista ?? [])].slice(0, 10);
    if (arquivos.length === 0) return;
    setEnviando(true);
    const ok = await enviarArquivos(arquivos, tipo, demonstrativoId);
    setEnviando(false);
    if (arquivo.current) arquivo.current.value = '';
    if (camera.current) camera.current.value = '';
    if (ok > 0) {
      toast.success(ok === 1 ? 'Documento guardado.' : `${ok} documentos guardados.`);
      await recarregar();
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSobre(false);
        void receber(e.dataTransfer.files);
      }}
      className={`rounded-2xl border border-dashed transition ${sobre ? 'border-medico bg-medico/5' : 'border-border'} ${compacto ? 'p-3' : 'p-4 sm:p-5'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeDocumento)} className={`${CAMPO} !w-auto`} aria-label="Tipo do documento">
          {TIPOS_DE_DOCUMENTO.map((t) => (
            <option key={t} value={t}>
              {TIPO_DE_DOCUMENTO_LABEL[t]}
            </option>
          ))}
        </select>
        <Botao ocupado={enviando} onClick={() => arquivo.current?.click()}>
          <Paperclip className="h-4 w-4" aria-hidden /> Escolher arquivo
        </Botao>
        <Botao tipo="secundario" desabilitado={enviando} onClick={() => camera.current?.click()}>
          <Camera className="h-4 w-4" aria-hidden /> Tirar foto
        </Botao>
        <input ref={arquivo} type="file" accept={ACEITA} multiple className="hidden" onChange={(e) => void receber(e.target.files)} />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void receber(e.target.files)} />
      </div>
      {!compacto && <p className="mt-2 text-xs text-muted-foreground">Ou arraste os arquivos para cá. PDF, foto, XML, Excel ou Word, até 20 MB cada.</p>}
    </div>
  );
}

/** Lista de documentos, com baixar e apagar. */
export function ListaDeDocumentos({ documentos, recarregar, vazio }: Pick<PropsDaAba, 'recarregar'> & { documentos: Documento[]; vazio?: string }) {
  async function apagar(d: Documento) {
    if (!window.confirm(`Apagar "${d.nome}"?`)) return;
    const res = await fetch(`/api/medico/documentos/${d.id}`, { method: 'DELETE' });
    if (!res.ok) return void toast.error('Não foi possível apagar agora.');
    await recarregar();
  }

  if (documentos.length === 0) return vazio ? <p className="text-sm text-muted-foreground">{vazio}</p> : null;
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {documentos.map((d) => (
        <li key={d.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-medico/10 text-medico">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{d.nome}</span>
            <span className="block text-xs text-muted-foreground">
              {TIPO_DE_DOCUMENTO_LABEL[d.tipo]} · {tamanho(d.tamanho)} · {dataBr(d.created_at.slice(0, 10))}
            </span>
          </span>
          <a href={`/api/medico/documentos/${d.id}`} aria-label={`Baixar ${d.nome}`} title="Baixar" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Download className="h-4 w-4" aria-hidden />
          </a>
          <button type="button" onClick={() => void apagar(d)} aria-label={`Apagar ${d.nome}`} title="Apagar" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-red-600">
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Aba Documentos: tudo o que o médico guardou. */
export function Documentos({ estado, recarregar }: PropsDaAba) {
  const [filtro, setFiltro] = useState<TipoDeDocumento | ''>('');
  const lista = estado.documentos.filter((d) => !filtro || d.tipo === filtro);
  return (
    <div className="space-y-4">
      <section className={CARTAO}>
        <h2 className="text-base font-semibold flex items-center gap-1">Guardar documento <Info>Nota fiscal, demonstrativo do hospital, comprovante de pagamento ou o que você precisar ter à mão.</Info></h2>
        <Anexar recarregar={recarregar} tipoInicial="nota" />
      </section>
      <section className={CARTAO}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Seus documentos</h2>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as TipoDeDocumento | '')} className={`${CAMPO} !w-auto`} aria-label="Filtrar por tipo">
            <option value="">Todos os tipos</option>
            {TIPOS_DE_DOCUMENTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_DE_DOCUMENTO_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <ListaDeDocumentos documentos={lista} recarregar={recarregar} vazio="Nenhum documento guardado ainda." />
      </section>
    </div>
  );
}
