// Agendador interno (sub-projeto 101). O Railway roda o Next como processo de
// longa duração, então um temporizador aqui dentro basta para a rodada diária
// de avisos da Área Médica, sem serviço de cron separado.
//
// A cada 15 minutos confere se é de manhã em Brasília; a rodada em si é
// idempotente (cada médico é reservado por um UPDATE condicional no banco),
// então rodar várias vezes, ou em mais de uma réplica, não duplica aviso.

const INTERVALO_MS = 15 * 60 * 1000;

export function iniciarAgendador() {
  if (process.env.APP_ENV !== 'production') return;

  const g = globalThis as { __areaMedicaAvisos?: boolean };
  if (g.__areaMedicaAvisos) return;
  g.__areaMedicaAvisos = true;

  const rodar = async () => {
    try {
      // Mantém viva a autorização dos médicos no BTG (o refresh token vence em 10 dias).
      const { renovarConexoes } = await import('@/lib/medico/btg');
      await renovarConexoes().catch((e) => console.error('[medico/btg] renovação:', e instanceof Error ? e.message : e));

      const { enviarAvisosDoDia, horaDeAvisar } = await import('@/lib/medico/avisos');
      if (!horaDeAvisar() || process.env.AREA_MEDICA_AVISOS === 'false') return;
      const r = await enviarAvisosDoDia();
      if (r.enviados > 0) console.log(`[medico/avisos] ${r.enviados} aviso(s) enviado(s)`);
    } catch (err) {
      console.error('[medico/avisos] rodada falhou:', err instanceof Error ? err.message : err);
    }
  };

  setTimeout(rodar, 60_000).unref?.();
  setInterval(rodar, INTERVALO_MS).unref?.();
}
