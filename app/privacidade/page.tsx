import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  PRODUCT_NAME,
  COMPANY_NAME,
  COMPANY_CNPJ,
  LEGAL_CONTACT_EMAIL,
} from '@/lib/legal/constants';

export const metadata: Metadata = {
  title: `Política de Privacidade · ${PRODUCT_NAME}`,
  description: `Como o ${PRODUCT_NAME} trata seus dados pessoais conforme a LGPD.`,
};

const PRIVACIDADE_MD = `
Esta Política de Privacidade descreve como o ${PRODUCT_NAME}
("Plataforma", "nós") coleta, usa, armazena e compartilha seus dados
pessoais, em conformidade com a **Lei Geral de Proteção de Dados
(Lei 13.709/2018, LGPD)** e o **Marco Civil da Internet (Lei
12.965/2014)**.

Ao usar a Plataforma, você concorda com as práticas descritas aqui.

## 1. Controlador dos Dados

O controlador dos seus dados pessoais é a **${COMPANY_NAME}** (CNPJ
${COMPANY_CNPJ}), responsável pelo ${PRODUCT_NAME}.

Encarregado de Proteção de Dados (DPO) e canal de contato:
**${LEGAL_CONTACT_EMAIL}**

## 2. Quais Dados Coletamos

### 2.1 Dados que você fornece

| Dado | Quando | Finalidade |
|---|---|---|
| **Email** | Cadastro | Login, recuperação de senha, comunicação transacional |
| **Senha (hash)** | Cadastro | Autenticação. Nunca armazenamos senha em texto puro, apenas hash bcrypt via Supabase Auth |
| **Nome completo, telefone e empresa** | Cadastro / contratação | Identificação do cliente e cobrança |
| **CPF ou CNPJ** | Cadastro / contratação | Identificação fiscal exigida na cobrança. Fica guardado no seu perfil e é repassado à Asaas |
| **CEP e número do endereço** | Cadastro com cartão | Exigidos pela Asaas para validar o cartão. Repassados à Asaas |
| **Dados do cartão** | Contratação | Repassados diretamente à Asaas no momento do pagamento. **Não ficam gravados no nosso banco de dados** |
| **Conteúdo de chats** | Uso do chat | Gerar respostas via IA, manter histórico pra você acessar depois |
| **Anexos e documentos enviados** | Chat, Equalizador, Análise de Gastos e outros assistentes | Ler o documento para gerar a análise pedida. O texto extraído fica no histórico da conversa ou da análise. **Seus documentos não entram na base de conhecimento** usada para responder outros clientes |
| **Áudio (modo voz e ditado)** | Quando você usa o microfone | Transcrever e responder por voz. O áudio não é gravado no nosso banco; a transcrição fica no histórico da conversa |
| **Bases de fornecedores e materiais** | Quando você importa ou cadastra | Organizar e pesquisar seus fornecedores e materiais |
| **Parâmetros de assistentes** | Uso de assistentes | Gerar RFPs/análises/etc. Mantemos no histórico (\`assistant_runs\`) |
| **Feedback** (👍/👎 + comentário) | Botões de feedback | Melhorar o produto |
| **Perfil da Categoria** | Criação manual ou via upload | Personalizar respostas |

### 2.2 Dados que coletamos automaticamente

| Dado | Como | Finalidade |
|---|---|---|
| **Endereço IP (hash)** | Pré-cadastro / reset de senha | Rate-limit anti-bot. **Não armazenamos o IP cru**, apenas um hash criptográfico (SHA-256 + salt secreto) na tabela \`rate_limit_events_anon\`. Impossível reverter pra IP original sem o salt |
| **Cookies de sessão** | Login | Manter você autenticado (detalhes na [Política de Cookies](/cookies)) |
| **Token Cloudflare Turnstile** | Signup / reset | Verificação anti-bot (verifique [docs da Cloudflare](https://www.cloudflare.com/turnstile/)) |
| **Logs de uso de API** | Cada chamada LLM | Contabilidade interna de custos. Armazenamos *qual operação* e *quanto custou*, sem conteúdo |
| **Registros técnicos (observabilidade)** | Cada resposta da IA | Medir tempo, custo e qualidade das etapas. Contém identificador pseudonimizado e métricas, **sem o conteúdo das conversas ou dos anexos** |
| **Registro de acessos administrativos** | Ações da equipe | Auditoria: quem da nossa equipe fez o quê e quando |

### 2.3 Dados que NÃO coletamos

- Geolocalização precisa
- Dados sensíveis (saúde, orientação sexual, opinião política, etc.), não envie esse tipo de informação no chat
- Dados de menores de 18 anos, a Plataforma não é destinada a menores

## 3. Por Que Coletamos (Bases Legais LGPD)

Para cada categoria de dado, a base legal aplicável é:

- **Execução de contrato** (Art. 7º, V): email/senha/conteúdos pra prestar o serviço contratado
- **Cumprimento de obrigação legal** (Art. 7º, II): retenção de dados fiscais (Nome+CPF via Asaas) por 5 anos conforme legislação tributária
- **Legítimo interesse** (Art. 7º, IX): logs de rate-limit anti-fraude, hash de IP, logs de API. Você pode contestar nossas justificativas via ${LEGAL_CONTACT_EMAIL}
- **Consentimento** (Art. 7º, I): cookies não-essenciais, comunicação de marketing (quando aplicável). Você pode revogar a qualquer momento

## 4. Como Compartilhamos Seus Dados

Compartilhamos dados estritamente com **operadores necessários pra prestação do serviço**:

| Operador | O que recebe | Finalidade |
|---|---|---|
| **Supabase** (EUA) | Email, senha hash, perfil, conteúdo de chats, histórico de assistentes, arquivos enviados | Banco de dados, autenticação e armazenamento de arquivos |
| **Railway** (EUA) | Tráfego da aplicação e logs do servidor | Hospedagem da Plataforma e do serviço de consulta fiscal |
| **OpenAI** (EUA) | Conteúdo dos chats, anexos, prompts dos assistentes, áudio do modo voz e termos de buscas na internet | Geração das respostas, leitura de documentos, voz e busca na web |
| **Voyage AI** (EUA) | Texto da sua pergunta | Cálculo de similaridade para buscar na base de conhecimento |
| **Cohere** (EUA/Canadá) | Texto da pergunta + trechos da base de conhecimento | Ordenar os trechos mais relevantes |
| **Langfuse** (União Europeia, Irlanda) | Identificador pseudonimizado + métricas técnicas, **sem conteúdo das conversas** | Observabilidade interna |
| **Asaas** (Brasil) | Nome, CPF/CNPJ, email, telefone, CEP, dados do cartão, valor da assinatura | Processamento de pagamento e emissão de NF |
| **Titan Email (Hostgator)** | Email, nome e conteúdo dos emails que enviamos a você | Envio de emails transacionais (boas-vindas, cobrança, convites) |
| **Resend** (EUA) | Emails que você ou seus fornecedores enviam ao endereço de recebimento da Plataforma | Recebimento de cotações por email (só se você usar esse recurso) |
| **Cloudflare** (global) | IP, headers do navegador | Verificação anti-bot via Turnstile |
| **Google** (EUA) | Dados da sua conta Google, se você escolher entrar com Google | Login |

**Consultas a bases públicas**: quando você pesquisa uma empresa ou um
preço, enviamos o CNPJ ou o termo pesquisado a bases públicas
(Receita Federal via BrasilAPI e ReceitaWS, Portal da Transparência,
Compras.gov.br/PNCP e Banco Central). São dados de empresas e de
compras públicas, não dados pessoais seus.

**Uso pela IA**: o conteúdo enviado aos provedores de IA é usado só para
gerar a resposta pedida. A OpenAI não usa dados recebidos pela API para
treinar seus modelos e pode guardá-los por até 30 dias para
monitoramento de abuso, conforme a política dela. Pedimos que as
respostas não fiquem armazenadas na OpenAI e apagamos de lá os arquivos
enviados assim que são lidos. Seus documentos e
conversas não são incorporados à base de conhecimento do ${PRODUCT_NAME}.

**Acesso da nossa equipe**: para prestar suporte, a equipe ${COMPANY_NAME}
pode acessar sua conta. Todo acesso administrativo fica registrado em
log de auditoria.

**Transferência internacional**: operamos com fornecedores nos EUA e na
União Europeia. A LGPD permite transferência internacional pra
prestadores de serviço em países que ofereçam grau de proteção adequado
ou via cláusulas contratuais específicas. A transferência se apoia nos
termos de proteção de dados e nas cláusulas contratuais oferecidos por
cada operador.

**Não vendemos seus dados**. Nunca compartilhamos com anunciantes, redes
sociais ou data brokers.

## 5. Por Quanto Tempo Mantemos

| Dado | Retenção |
|---|---|
| Conta + perfil + histórico de chats e assistentes | Até você excluir a conta. Após exclusão: apagado em até 24h |
| Logs de API (anonimizados) | Indefinido, sem vínculo direto com usuário após exclusão |
| Dados fiscais (Asaas) | 5 anos conforme legislação tributária, gerenciado pela Asaas |
| Rate-limit events | 2 horas (cleanup automático) |
| Feedback (👍/👎) | Até você excluir a conta |
| Conteúdo enviado à OpenAI | Até 30 dias no provedor, para monitoramento de abuso, conforme a política da OpenAI |

## 6. Seus Direitos (Art. 18 da LGPD)

Como titular dos dados, você tem direito a:

1. **Confirmação** de que tratamos seus dados, basta logar e ver seu perfil
2. **Acesso** aos seus dados, exporte chats e assistant_runs via API ou solicite via ${LEGAL_CONTACT_EMAIL}
3. **Correção** de dados incompletos ou desatualizados, edite no \`/profile\`
4. **Anonimização ou eliminação**, exclua sua conta em \`/account/delete\` (irreversível)
5. **Portabilidade**, solicite cópia em formato JSON via ${LEGAL_CONTACT_EMAIL} (atendemos em até 15 dias)
6. **Eliminação dos dados tratados com consentimento**, revogue cookies em \`/cookies\` ou exclua a conta
7. **Informação sobre compartilhamento**, esta Política já lista todos os operadores (Seção 4)
8. **Revogação do consentimento**, a qualquer momento, sem ônus
9. **Oposição** a tratamento baseado em legítimo interesse, fale com nosso DPO

Para exercer qualquer direito, escreva pra **${LEGAL_CONTACT_EMAIL}** com
o assunto "LGPD, Solicitação de Direitos". Respondemos em até 15 dias
úteis (prazo da ANPD).

## 7. Segurança

Tomamos medidas técnicas e organizacionais razoáveis pra proteger seus
dados:

- TLS/SSL em todo tráfego (HTTPS-only)
- Senhas com hash bcrypt (nunca em texto puro)
- IP nunca armazenado cru, sempre hash com salt secreto
- Dados de cartão não gravados no nosso banco, repassados diretamente à Asaas
- Criptografia em repouso (AES-256) no banco de dados e no armazenamento de arquivos
- Cookies httpOnly + secure + sameSite
- Captcha (Cloudflare Turnstile) em endpoints públicos
- Rate-limit em chat (10/min, 60/h) e em signup/reset (3/min por IP)
- Row Level Security (RLS) no Supabase impede vazamento cruzado entre usuários
- Observabilidade (Langfuse) recebe só métricas e identificador pseudonimizado, nunca o conteúdo das conversas ou anexos
- Acessos administrativos registrados em log de auditoria
- Service-role keys nunca expostas no client
- Captcha + rate-limit em /api/auth/* pra prevenir enumeration

Apesar das medidas, nenhum sistema é 100% seguro. Se descobrir
vulnerabilidade, reporte responsavelmente via ${LEGAL_CONTACT_EMAIL}
(security disclosure policy: atendemos em até 72h).

## 8. Incidentes de Segurança

Em caso de incidente que possa acarretar risco aos titulares,
comunicaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os
titulares afetados em prazo razoável (Art. 48 LGPD).

## 9. Cookies

Detalhamento completo de cookies usados está em [Política de Cookies](/cookies).

## 10. Crianças e Adolescentes

O ${PRODUCT_NAME} **não é destinado a menores de 18 anos**. Não coletamos
intencionalmente dados de menores. Se você suspeitar que um menor criou
conta, escreva pra ${LEGAL_CONTACT_EMAIL} pra remoção imediata.

## 11. Mudanças nesta Política

Podemos atualizar esta Política conforme o serviço evolui. Mudanças
materiais serão anunciadas por email + banner na Plataforma com 30 dias
de antecedência. Para mudanças não-materiais (correções, clarificações),
a versão atualizada entra em vigor na publicação. O histórico de versões
fica disponível mediante solicitação.

## 12. Contato e DPO

**Encarregado de Proteção de Dados**: ${LEGAL_CONTACT_EMAIL}

**Autoridade Nacional de Proteção de Dados (ANPD)**: você pode também
denunciar ou tirar dúvidas diretamente com a ANPD em
[anpd.gov.br](https://www.anpd.gov.br/).
`;

export default function PrivacidadePage() {
  return <LegalDocument title="Política de Privacidade" markdown={PRIVACIDADE_MD} />;
}
