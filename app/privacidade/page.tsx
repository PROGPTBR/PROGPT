import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { PRODUCT_NAME, LEGAL_CONTACT_EMAIL } from '@/lib/legal/constants';

export const metadata: Metadata = {
  title: `Política de Privacidade · ${PRODUCT_NAME}`,
  description: `Como o ${PRODUCT_NAME} trata seus dados pessoais conforme a LGPD.`,
};

const PRIVACIDADE_MD = `
Esta Política de Privacidade descreve como o ${PRODUCT_NAME}
("Plataforma", "nós") coleta, usa, armazena e compartilha seus dados
pessoais, em conformidade com a **Lei Geral de Proteção de Dados
(Lei 13.709/2018 — LGPD)** e o **Marco Civil da Internet (Lei
12.965/2014)**.

Ao usar a Plataforma, você concorda com as práticas descritas aqui.

## 1. Controlador dos Dados

O controlador dos seus dados pessoais é **[CNPJ A CADASTRAR]**, empresa
em constituição responsável pelo ${PRODUCT_NAME}.

Encarregado de Proteção de Dados (DPO): ${LEGAL_CONTACT_EMAIL}

## 2. Quais Dados Coletamos

### 2.1 Dados que você fornece

| Dado | Quando | Finalidade |
|---|---|---|
| **Email** | Cadastro | Login, recuperação de senha, comunicação transacional |
| **Senha (hash)** | Cadastro | Autenticação. Nunca armazenamos senha em texto puro — apenas hash bcrypt via Supabase Auth |
| **Nome completo** | Upgrade pra Pro | Emissão de nota fiscal pela Asaas |
| **CPF** | Upgrade pra Pro | Identificação fiscal exigida pela Asaas. **Não armazenamos seu CPF no nosso banco de dados** — repassamos diretamente pra Asaas, que cuida do tratamento conforme política deles |
| **Conteúdo de chats** | Uso do chat | Gerar respostas via IA, manter histórico pra você acessar depois |
| **Parâmetros de assistentes** | Uso de assistentes | Gerar RFPs/análises/etc. Mantemos no histórico (\`assistant_runs\`) |
| **Feedback** (👍/👎 + comentário) | Botões de feedback | Melhorar o produto |
| **Perfil da Categoria** | Criação manual ou via upload | Personalizar respostas |

### 2.2 Dados que coletamos automaticamente

| Dado | Como | Finalidade |
|---|---|---|
| **Endereço IP (hash)** | Pré-cadastro / reset de senha | Rate-limit anti-bot. **Não armazenamos o IP cru** — apenas um hash criptográfico (SHA-256 + salt secreto) na tabela \`rate_limit_events_anon\`. Impossível reverter pra IP original sem o salt |
| **Cookies de sessão** | Login | Manter você autenticado (detalhes na [Política de Cookies](/cookies)) |
| **Token Cloudflare Turnstile** | Signup / reset | Verificação anti-bot (verifique [docs da Cloudflare](https://www.cloudflare.com/turnstile/)) |
| **Logs de uso de API** | Cada chamada LLM | Contabilidade interna de custos. Armazenamos *qual operação* e *quanto custou*, sem conteúdo |

### 2.3 Dados que NÃO coletamos

- Geolocalização precisa
- Dados sensíveis (saúde, orientação sexual, opinião política, etc.) — não envie esse tipo de informação no chat
- Dados de menores de 18 anos — a Plataforma não é destinada a menores

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
| **Supabase** (Singapura/EUA) | Email, senha hash, conteúdo de chats, histórico de assistentes | Banco de dados + autenticação |
| **Asaas** (Brasil) | Nome, CPF, email, valor da assinatura | Processamento de pagamento + emissão de NF |
| **OpenAI** (EUA) | Conteúdo dos chats e prompts dos assistentes | Geração das respostas via gpt-4o-mini |
| **Voyage AI** (EUA) | Trechos da sua pergunta + base de conhecimento | Embedding pra retrieval (RAG) |
| **Cohere** (EUA/Canadá) | Trechos da pergunta + candidatos recuperados | Reranking dos resultados |
| **Cloudflare** (global) | IP, headers do navegador | Verificação anti-bot via Turnstile |
| **Langfuse** (Alemanha) | UUID pseudonimizado + metadados de traces (sem PII) | Observabilidade interna |
| **Railway** (EUA) | Logs do servidor (sem PII direta) | Hospedagem da Plataforma |

**Transferência internacional**: Operamos com fornecedores em EUA/UE/Ásia.
A LGPD permite transferência internacional pra prestadores de serviço em
países que ofereçam grau de proteção adequado ou via cláusulas
contratuais específicas. Garantimos contratos de proteção de dados (DPAs)
com cada operador.

**Não vendemos seus dados**. Nunca compartilhamos com anunciantes, redes
sociais ou data brokers.

## 5. Por Quanto Tempo Mantemos

| Dado | Retenção |
|---|---|
| Conta + perfil + histórico de chats e assistentes | Até você excluir a conta. Após exclusão: apagado em até 24h |
| Logs de API (anonimizados) | Indefinido — sem vínculo direto com usuário após exclusão |
| Dados fiscais (Asaas) | 5 anos conforme legislação tributária — gerenciado pela Asaas |
| Rate-limit events | 2 horas (cleanup automático) |
| Feedback (👍/👎) | Até você excluir a conta |

## 6. Seus Direitos (Art. 18 da LGPD)

Como titular dos dados, você tem direito a:

1. **Confirmação** de que tratamos seus dados — basta logar e ver seu perfil
2. **Acesso** aos seus dados — exporte chats e assistant_runs via API ou solicite via ${LEGAL_CONTACT_EMAIL}
3. **Correção** de dados incompletos ou desatualizados — edite no \`/profile\`
4. **Anonimização ou eliminação** — exclua sua conta em \`/account/delete\` (irreversível)
5. **Portabilidade** — solicite cópia em formato JSON via ${LEGAL_CONTACT_EMAIL} (atendemos em até 15 dias)
6. **Eliminação dos dados tratados com consentimento** — revogue cookies em \`/cookies\` ou exclua a conta
7. **Informação sobre compartilhamento** — esta Política já lista todos os operadores (Seção 4)
8. **Revogação do consentimento** — a qualquer momento, sem ônus
9. **Oposição** a tratamento baseado em legítimo interesse — fale com nosso DPO

Para exercer qualquer direito, escreva pra **${LEGAL_CONTACT_EMAIL}** com
o assunto "LGPD — Solicitação de Direitos". Respondemos em até 15 dias
úteis (prazo da ANPD).

## 7. Segurança

Tomamos medidas técnicas e organizacionais razoáveis pra proteger seus
dados:

- TLS/SSL em todo tráfego (HTTPS-only)
- Senhas com hash bcrypt (nunca em texto puro)
- IP nunca armazenado cru — sempre hash com salt secreto
- CPF não armazenado no nosso DB — repassado diretamente pra Asaas
- Cookies httpOnly + secure + sameSite
- Captcha (Cloudflare Turnstile) em endpoints públicos
- Rate-limit em chat (10/min, 60/h) e em signup/reset (3/min por IP)
- Row Level Security (RLS) no Supabase impede vazamento cruzado entre usuários
- Logs sem PII; UUIDs pseudonimizados na observabilidade (Langfuse)
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
