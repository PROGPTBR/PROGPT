import { sendEmail } from '@/lib/email/client';

import { enviarDocumento, enviarTexto, estadoDaInstancia, instanciaDoMedico, numeroLimpo, whatsappConfigurado } from './evolution';
import { paraCobrar } from './conciliacao';
import { cobranca, cobrancaAoPaciente, envioDaNota, pedidoDeNota, pedidoDeNotaDireto, type Mensagem } from './mensagens';
import { notaGuardada } from './documentos';
import { nomeDoArquivo, planilhaDePendencias } from './planilha-pendencias';
import { atualizarDemonstrativo, carregarEstado, registrarCobranca, RegraMedica } from './service';

// Envio automático da Área Médica (sub-projeto 101): o sistema manda o e-mail
// (ou o WhatsApp ao paciente) em nome do médico e já avança a etapa.
//
// O DESTINATÁRIO nunca vem do navegador: sai do cadastro (contador, hospital,
// contato do paciente). O médico pode ajustar o texto, não para quem vai.

export type TipoDeEnvio = 'pedido_nota' | 'envio_nota' | 'cobranca_hospital' | 'cobranca_paciente';
export type Anexo = { nome: string; buf: Buffer; mime: string };

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export async function enviarMensagem(
  userId: string,
  pedido: { tipo: TipoDeEnvio; canal: 'email' | 'whatsapp'; id: string; corpo?: string; anexo?: Anexo | null },
  hoje: string,
): Promise<void> {
  const estado = await carregarEstado(userId);
  const { config } = estado;

  let mensagem: Mensagem;
  let aoConcluir: () => Promise<unknown>;
  let anexo = pedido.anexo ?? null;

  if (pedido.tipo === 'cobranca_hospital') {
    const hospital = estado.hospitais.find((h) => h.id === pedido.id);
    const abertas = paraCobrar(estado.cirurgias, estado.demonstrativos, pedido.id, hoje);
    if (!hospital || abertas.length === 0) throw new RegraMedica('Não há cirurgias pendentes nesse hospital.');
    mensagem = cobranca(abertas, hospital, config);
    // A cobrança vai sempre na planilha de pendências, o modelo que o hospital exige.
    anexo = {
      nome: nomeDoArquivo(hospital, config, hoje),
      buf: await planilhaDePendencias(abertas, config),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    aoConcluir = () => registrarCobranca(userId, abertas, hoje);
  } else {
    const d = estado.demonstrativos.find((x) => x.id === pedido.id);
    const hospital = d && estado.hospitais.find((h) => h.id === d.hospital_id);
    if (!d || !hospital) throw new RegraMedica('Registro não encontrado.');
    if (pedido.tipo === 'pedido_nota') {
      mensagem = d.tipo === 'direto' ? pedidoDeNotaDireto(d, hospital, config) : pedidoDeNota(d, hospital, config);
      aoConcluir = () => atualizarDemonstrativo(userId, d.id, { nota_pedida_em: hoje });
    } else if (pedido.tipo === 'envio_nota' && d.tipo === 'hospital') {
      mensagem = envioDaNota(d, hospital, config);
      aoConcluir = () => atualizarDemonstrativo(userId, d.id, { nota_enviada_em: hoje });
    } else if (pedido.tipo === 'cobranca_paciente' && d.tipo === 'direto') {
      mensagem = cobrancaAoPaciente(d, config);
      aoConcluir = () => atualizarDemonstrativo(userId, d.id, { nota_enviada_em: hoje });
    } else {
      throw new RegraMedica('Esse envio não vale para este registro.');
    }
  }

  // Sem anexo escolhido na hora, a nota guardada no recebimento vai junto.
  if (!anexo && (pedido.tipo === 'envio_nota' || pedido.tipo === 'cobranca_paciente')) {
    anexo = await notaGuardada(userId, pedido.id).catch(() => null);
  }

  const corpo = (pedido.corpo ?? '').trim().slice(0, 20_000) || mensagem.corpo;

  if (pedido.canal === 'whatsapp') {
    if (pedido.tipo !== 'cobranca_paciente') throw new RegraMedica('Por WhatsApp só vai a cobrança ao paciente.');
    if (!whatsappConfigurado()) throw new RegraMedica('O WhatsApp não está ligado no servidor.');
    const numero = numeroLimpo(mensagem.para);
    if (!numero) throw new RegraMedica('O contato do paciente não é um número de WhatsApp. Corrija na cobrança ou envie por e-mail.');
    const instancia = instanciaDoMedico(userId);
    if ((await estadoDaInstancia(instancia)) !== 'open') throw new RegraMedica('Conecte o seu WhatsApp em Integrações para enviar por ele.');
    await enviarTexto(instancia, numero, corpo);
    if (anexo) {
      await enviarDocumento(instancia, numero, { nome: anexo.nome, base64: anexo.buf.toString('base64'), mime: anexo.mime });
    }
  } else {
    if (!emailValido(mensagem.para)) {
      throw new RegraMedica(
        pedido.tipo === 'pedido_nota'
          ? 'Cadastre o e-mail do contador em Cadastros.'
          : pedido.tipo === 'cobranca_paciente'
            ? 'O contato do paciente não é um e-mail.'
            : 'Cadastre o e-mail do hospital em Cadastros.',
      );
    }
    const doMedico = emailValido(config.medico_email) ? config.medico_email.trim() : undefined;
    const r = await sendEmail({
      to: mensagem.para.trim(),
      subject: mensagem.assunto,
      text: corpo,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">${esc(corpo).replace(/\r?\n/g, '<br/>')}</div>`,
      fromName: config.medico_nome ? `${config.medico_nome} (via 2BSUPPLY.IA)` : undefined,
      // A resposta volta para o médico, e ele recebe cópia do que saiu em nome dele.
      replyTo: doMedico,
      cc: doMedico,
      attachments: anexo ? [{ filename: anexo.nome, content: anexo.buf, contentType: anexo.mime }] : undefined,
    });
    if (!r.ok) throw new RegraMedica('O e-mail não saiu agora. Tente de novo ou use "Abrir no e-mail".');
  }

  await aoConcluir();
}
