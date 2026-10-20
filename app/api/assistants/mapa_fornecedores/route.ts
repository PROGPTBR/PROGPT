import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { checkMapaFornecedoresRateLimit, MAPA_LIMITE_DIARIO } from '@/lib/rate-limit';
import { withUser } from '@/lib/observability/user-context';
import { createRun, failRun } from '@/lib/assistants/runs';
import { moduloBloqueado } from '@/lib/modulos/servidor';
import { semTravessao } from '@/lib/texto/sem-travessao';
import {
  buscarCategoria,
  emParalelo,
  localizar,
  planejar,
  streamRelatorio,
} from '@/lib/mapa-fornecedores/servidor';
import {
  distribuirFornecedores,
  porCategoriaAlvo,
  type EventoMapa,
  type FornecedorMapa,
  type ResultadoMapa,
} from '@/lib/mapa-fornecedores/tipos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ pedido: z.string().trim().min(15).max(8000) });

// POST /api/assistants/mapa_fornecedores { pedido }
// Resposta em NDJSON (uma linha JSON por evento, ver EventoMapa): o mapa vai
// se enchendo na tela enquanto as buscas por categoria terminam. Leva de 1 a
// 3 minutos; o processo do Railway é long-lived. O resultado completo fica
// em assistant_runs (params = ResultadoMapa, output_md = relatório) e aparece
// no Histórico.
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body', detail: 'Descreva a empresa e o que precisa mapear.' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (await moduloBloqueado(user.id, 'mapa_fornecedores')) {
    return NextResponse.json({ error: 'module_disabled' }, { status: 403 });
  }

  const rl = await checkMapaFornecedoresRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', detail: 'Muitos mapeamentos seguidos. Aguarde alguns minutos.', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }
  const svc = getServerSupabase();
  const { count } = await svc
    .from('assistant_runs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('assistant_type', 'mapa_fornecedores')
    .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((count ?? 0) >= MAPA_LIMITE_DIARIO) {
    return NextResponse.json(
      { error: 'daily_limit', detail: `Limite de ${MAPA_LIMITE_DIARIO} mapeamentos por dia atingido. Os anteriores estão no Histórico.` },
      { status: 429 },
    );
  }

  const run = await createRun({
    userId: user.id,
    assistantType: 'mapa_fornecedores',
    templateId: null,
    params: { pedido: body.pedido } as never,
    traceId: null,
  });
  if (!run) return NextResponse.json({ error: 'run_insert_failed' }, { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enviar = (e: EventoMapa) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
        } catch {
          // navegador fechou: o trabalho continua e o resultado fica no Histórico
        }
      };

      void withUser(user.id, async () => {
        enviar({ tipo: 'inicio', runId: run.id });
        try {
          const plano = await planejar(body.pedido);
          enviar({ tipo: 'plano', plano });

          const alvo = porCategoriaAlvo(plano.totalFornecedores, plano.categorias.length);
          let seq = 0;
          const porCategoria = await emParalelo(
            plano.categorias,
            4,
            async (c) => ({
              categoria: c.nome,
              fornecedores: (await buscarCategoria(plano, c, alvo)).map((f) => ({ ...f, id: `f${++seq}` })),
            }),
            (r) => enviar({ tipo: 'categoria', categoria: r.categoria, fornecedores: r.fornecedores }),
          );

          const escolhidos = distribuirFornecedores(porCategoria, plano.totalFornecedores);
          const localizados: FornecedorMapa[] = await localizar(escolhidos, plano);
          enviar({ tipo: 'pontos', fornecedores: localizados });

          let relatorio = '';
          const r = streamRelatorio(plano, localizados, body.pedido);
          for await (const delta of r.textStream) {
            relatorio += delta;
            enviar({ tipo: 'texto', delta });
          }
          relatorio = semTravessao(relatorio);

          const resultado: ResultadoMapa = {
            pedido: body.pedido,
            plano,
            fornecedores: localizados,
            relatorio,
            geradoEm: new Date().toISOString(),
          };
          await svc
            .from('assistant_runs')
            .update({ params: resultado, output_md: relatorio, status: 'done', finished_at: new Date().toISOString() })
            .eq('id', run.id)
            .eq('user_id', user.id);
          enviar({ tipo: 'fim', runId: run.id });
        } catch (err) {
          console.error('[api/assistants/mapa_fornecedores] failed:', err);
          await failRun(run.id, err instanceof Error ? err.message : String(err));
          enviar({ tipo: 'erro', mensagem: 'Não consegui concluir o mapeamento agora. Tente de novo em instantes.' });
        } finally {
          try {
            controller.close();
          } catch {
            // já fechado
          }
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Run-Id': run.id,
    },
  });
}
