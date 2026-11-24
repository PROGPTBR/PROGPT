import { cirurgiasDoDia, linhaDaAgenda } from './agenda';
import { avisos } from './conciliacao';
import type { EstadoMedico } from './types';

// Texto do aviso diário (sub-projeto 101). PURO. Sem nome de paciente: o
// aviso sai por WhatsApp e por e-mail, fora da tela protegida por login.

export type AvisoDoDia = { assunto: string; linhas: string[]; texto: string };

/** Null quando não há nada para fazer: nesse dia o médico não recebe mensagem. */
export function avisoDoDia(estado: Omit<EstadoMedico, 'integracoes'>, hoje: string, url: string): AvisoDoDia | null {
  const linhas = avisos(estado.demonstrativos, estado.cirurgias, estado.hospitais, hoje).map(
    (a) => `${a.texto}${a.dias > 0 ? ` (há ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'})` : ''}`.replace(/\((.+?) \(cobrança direta\)\)/, '$1'),
  );
  const zap = estado.entradas.filter((e) => e.canal === 'whatsapp').length;
  const email = estado.entradas.filter((e) => e.canal === 'email').length;
  if (zap > 0) linhas.push(`${zap} ${zap === 1 ? 'mensagem nova' : 'mensagens novas'} no grupo das cirurgias para conferir`);
  if (email > 0) linhas.push(`${email} ${email === 1 ? 'e-mail recebido' : 'e-mails recebidos'} para conferir`);
  // A agenda de hoje abre o aviso (sem paciente: só hora, hospital e procedimento).
  const hojeOpera = cirurgiasDoDia(estado.cirurgias, hoje).filter((c) => c.hora);
  if (linhas.length === 0 && hojeOpera.length === 0) return null;

  // Na cobrança direta o aviso leva o nome de quem paga; fora da tela vai sem.
  const seguras = linhas.map((l) => l.replace(/^.+ \(cobrança direta\):/, 'Cobrança direta:'));
  const nome = estado.config.medico_nome ? `, ${estado.config.medico_nome}` : '';
  const n = seguras.length;
  return {
    assunto: n > 0 ? `Área Médica: ${n} ${n === 1 ? 'pendência' : 'pendências'} hoje` : 'Área Médica: sua agenda de hoje',
    linhas: seguras,
    texto:
      `Bom dia${nome}.` +
      (hojeOpera.length > 0 ? ` Sua agenda de hoje:\n\n${hojeOpera.map((c) => `• ${linhaDaAgenda(c, estado.hospitais)}`).join('\n')}\n\n` : ' ') +
      (seguras.length > 0 ? `${hojeOpera.length > 0 ? 'Pendências' : 'Hoje'} na Área Médica:\n\n${seguras.map((l) => `• ${l}`).join('\n')}\n\n` : '') +
      `Abrir: ${url}`,
  };
}
