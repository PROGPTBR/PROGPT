'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MODULOS, type ModuloGrupo } from '@/lib/modulos/catalogo';

// Liga/desliga módulos de uma empresa (org). Grava só a lista dos desligados
// em orgs.org_settings.modulos_desativados (PATCH /api/plataforma/orgs/[id]).

const GRUPOS: { id: ModuloGrupo; titulo: string }[] = [
  { id: 'assistentes', titulo: 'Assistentes' },
  { id: 'plataforma', titulo: 'Plataforma' },
];

export function ModulosDialog({
  org,
  aberto,
  onFechar,
  onSalvo,
}: {
  org: { id: string; name: string; desativados: string[] };
  aberto: boolean;
  onFechar: () => void;
  onSalvo: (desativados: string[]) => void;
}) {
  const [desligados, setDesligados] = useState<Set<string>>(new Set(org.desativados));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) setDesligados(new Set(org.desativados));
  }, [aberto, org.desativados]);

  function alternar(id: string) {
    setDesligados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function marcarGrupo(grupo: ModuloGrupo, ligar: boolean) {
    setDesligados((prev) => {
      const n = new Set(prev);
      for (const m of MODULOS) {
        if (m.grupo !== grupo) continue;
        if (ligar) n.delete(m.id);
        else n.add(m.id);
      }
      return n;
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      const lista = MODULOS.filter((m) => desligados.has(m.id)).map((m) => m.id);
      const res = await fetch(`/api/plataforma/orgs/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulosDesativados: lista }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      toast.success('Módulos atualizados', {
        description: 'Vale no próximo carregamento de página dos usuários desta empresa.',
      });
      onSalvo(lista);
      onFechar();
    } catch (err) {
      toast.error('Não foi possível salvar os módulos', { description: String(err) });
    } finally {
      setSalvando(false);
    }
  }

  const ligados = MODULOS.length - desligados.size;

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Módulos de {org.name}</DialogTitle>
          <DialogDescription>
            Marque o que esta empresa pode usar. O que ficar desmarcado some dos menus e do chat, e a
            tela mostra que não está no plano. {ligados} de {MODULOS.length} ligados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {GRUPOS.map((g) => (
            <section key={g.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{g.titulo}</h3>
                <div className="flex gap-2 text-xs">
                  <button type="button" className="text-primary hover:underline" onClick={() => marcarGrupo(g.id, true)}>
                    Marcar todos
                  </button>
                  <button type="button" className="text-muted-foreground hover:underline" onClick={() => marcarGrupo(g.id, false)}>
                    Desmarcar todos
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {MODULOS.filter((m) => m.grupo === g.id).map((m) => {
                  const ligado = !desligados.has(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        ligado ? 'border-primary/40 bg-primary/5' : 'border-border text-muted-foreground'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={ligado}
                        onChange={() => alternar(m.id)}
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                      {m.rotulo}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar módulos'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
