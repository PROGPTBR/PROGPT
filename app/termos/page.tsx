import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  PRODUCT_NAME,
  COMPANY_NAME,
  COMPANY_CNPJ,
  LEGAL_CONTACT_EMAIL,
} from '@/lib/legal/constants';

export const metadata: Metadata = {
  title: `Termos de Uso · ${PRODUCT_NAME}`,
  description: `Termos de Uso da plataforma ${PRODUCT_NAME}.`,
};

const TERMOS_MD = `
## 1. Aceitação dos Termos

Ao criar uma conta e usar o ${PRODUCT_NAME} ("Plataforma"), você declara ter
lido, compreendido e aceito integralmente estes Termos de Uso ("Termos"),
bem como a [Política de Privacidade](/privacidade) e a [Política de Cookies](/cookies).
Se você não concorda com qualquer cláusula, **não utilize a Plataforma**.

Você precisa ter pelo menos 18 anos e capacidade civil plena para usar a
Plataforma. Se você usar em nome de uma empresa, declara ter poderes pra
vinculá-la a estes Termos.

## 2. Descrição do Serviço

O ${PRODUCT_NAME} é uma plataforma de Inteligência Artificial especializada
em compras corporativas (procurement). Oferecemos:

- **Chat especialista**: respostas fundamentadas em base de conhecimento curada
  sobre teorias e práticas de procurement (Kraljic, Porter, Monczka, Cox, etc.)
- **Assistentes**: ferramentas que executam tarefas específicas (geração de
  RFP, análise de Matriz de Kraljic, 5 Forças de Porter, análise financeira
  de fornecedor, Curva ABC, Perfil de Categoria, Simulador de Negociação)
- **Histórico** das suas sessões e execuções de assistentes

A Plataforma é uma **ferramenta de apoio à decisão**. Não substituímos
consultoria jurídica, financeira, contábil ou de procurement profissional.
Você é responsável por revisar e validar todo output antes de usá-lo em
contexto profissional.

## 3. Planos e Cobrança

### 3.1 Plano Free

Acesso gratuito permanente ao chat especialista e **1 (uma) execução
vitalícia** de cada um dos assistentes (RFP, Kraljic, Porter, Financeiro,
ABC, Perfil, Negociação — 7 execuções totais por conta).

### 3.2 Plano Pro

Mediante pagamento de assinatura mensal recorrente de R$ 99,00 (noventa
e nove reais), o Pro libera acesso ilimitado a todos os assistentes.

A cobrança é processada pela **Asaas Gestão Financeira S.A.** (CNPJ
19.540.550/0001-21), via cartão de crédito ou Pix recorrente. O ciclo
inicia na data do primeiro pagamento confirmado e renova
automaticamente todo mês na mesma data.

### 3.3 Cancelamento

Você pode cancelar a assinatura Pro a qualquer momento em
\`/account/billing\`. **O cancelamento entra em vigor ao fim do ciclo
atual já pago** — você mantém acesso Pro até essa data e não recebe
estorno proporcional.

### 3.4 Pagamento em atraso

Se uma cobrança falhar (cartão recusado, limite excedido etc.), a
assinatura entra em status "past_due" e você mantém acesso até o fim do
ciclo já pago. Se o problema não for resolvido até a próxima cobrança,
a assinatura é cancelada automaticamente.

### 3.5 Estornos e reembolsos

Conforme o **Art. 49 do Código de Defesa do Consumidor**, você tem
direito de arrependimento em até 7 (sete) dias corridos da contratação
inicial, com reembolso integral, **desde que não tenha executado
nenhum assistente Pro** nesse período. Após 7 dias ou após uso de
qualquer assistente Pro, não há reembolso retroativo — apenas
cancelamento end-of-period (cláusula 3.3).

### 3.6 Mudanças de preço

Podemos alterar o valor da assinatura mediante aviso prévio de 30
(trinta) dias. Você poderá cancelar antes do novo valor entrar em
vigor sem qualquer ônus.

## 4. Sua Conta

### 4.1 Cadastro

Você cria sua conta com email + senha. Confirme o email pelo link
enviado pra ativar a conta. É sua responsabilidade manter as
credenciais em segurança e não compartilhar com terceiros.

### 4.2 Atividade na conta

Você é responsável por toda atividade realizada na sua conta. Se
suspeitar de uso não autorizado, troque a senha imediatamente em
\`/forgot-password\` e nos comunique em ${LEGAL_CONTACT_EMAIL}.

### 4.3 Exclusão

Você pode excluir sua conta a qualquer momento em \`/account/delete\`.
A exclusão é **permanente e irreversível**: suas conversas,
execuções de assistentes e feedback são apagados em até 24 horas.
Eventos de uso de API (anonimizados) são preservados para
contabilidade interna.

## 5. Uso Aceitável

Você concorda em **não** usar a Plataforma para:

1. Atividades ilegais ou que violem direitos de terceiros
2. Tentar acessar dados de outros usuários, contas administrativas ou
   infraestrutura interna
3. Engenharia reversa, scraping em massa ou tentar replicar o serviço
4. Sobrecarregar a Plataforma com requisições automatizadas além dos
   limites de rate-limit (10 mensagens/minuto, 60 mensagens/hora no chat)
5. Gerar conteúdo discriminatório, difamatório, ofensivo ou que viole
   a Lei Geral de Proteção de Dados (LGPD) ou o Marco Civil da Internet
6. Submeter dados sensíveis de terceiros sem autorização (CPFs,
   contratos confidenciais, etc.)
7. Tentar burlar a quota gratuita criando múltiplas contas

Violação destas regras pode resultar em **suspensão imediata sem
aviso prévio**, sem direito a reembolso, e responsabilização civil e
criminal nos termos da lei.

## 6. Propriedade Intelectual

### 6.1 Da Plataforma

Todo o código, design, base de conhecimento curada, prompts internos
e infraestrutura do ${PRODUCT_NAME} é de propriedade exclusiva nossa
e protegido por leis de propriedade intelectual.

### 6.2 Dos seus inputs

Você mantém todos os direitos sobre os dados que envia (perguntas,
parâmetros de assistentes, arquivos uploaded). Concede-nos apenas a
licença limitada e não-exclusiva necessária pra processar a
requisição e gerar a resposta.

### 6.3 Dos outputs gerados

Os outputs gerados pela IA (respostas do chat, RFPs, análises Kraljic,
etc.) são **seus** — você pode usar livremente, inclusive
comercialmente. **Ressalva**: outputs podem conter referências a
frameworks acadêmicos (Kraljic 1983, Porter 1979, etc.) cujos direitos
autorais permanecem dos autores originais. Você é responsável por
citar fontes quando publicar conteúdo derivado.

### 6.4 Sem garantia de exclusividade

A IA pode gerar respostas similares para usuários diferentes que
fizerem perguntas similares. Não garantimos exclusividade ou
originalidade de qualquer output específico.

## 7. Limitação de Responsabilidade

A Plataforma é fornecida **"no estado em que se encontra"**, sem
garantias expressas ou implícitas de:

- Adequação a propósito específico
- Precisão, completude ou atualidade das respostas geradas
- Disponibilidade ininterrupta ou livre de erros
- Compatibilidade com seu fluxo de trabalho específico

A IA pode cometer erros, alucinar fatos ou gerar informações desatualizadas.
**Você é exclusivamente responsável** por revisar e validar todo output
antes de usar em contexto profissional, contratual ou financeiro.

Na máxima extensão permitida pela legislação brasileira, nossa
responsabilidade total perante você fica limitada ao **valor pago nos
últimos 12 (doze) meses** de assinatura.

## 8. Privacidade e Proteção de Dados

O tratamento de dados pessoais segue a Lei Geral de Proteção de Dados
(Lei 13.709/2018 — LGPD) e está detalhado na nossa
[Política de Privacidade](/privacidade), parte integrante destes Termos.

## 9. Alterações nos Termos

Podemos alterar estes Termos para refletir mudanças no produto,
operação ou legislação. Avisaremos com **30 (trinta) dias de
antecedência** mudanças materiais (preço, cancelamento, escopo do
serviço) por email e via banner na Plataforma. Mudanças não-materiais
(correções, esclarecimentos) entram em vigor imediatamente.

O uso continuado após a entrada em vigor constitui aceitação dos
novos Termos. Se não concordar, cancele a assinatura e exclua a
conta antes da data efetiva.

## 10. Encerramento

Podemos suspender ou encerrar sua conta a qualquer momento em caso
de violação destes Termos, atividade fraudulenta, inadimplência
recorrente ou determinação judicial. Nesses casos, não há direito a
reembolso proporcional.

## 11. Legislação e Foro

Estes Termos são regidos pelas leis da República Federativa do
Brasil. Fica eleito o foro da comarca de **São Paulo - SP** para
dirimir qualquer controvérsia, **salvo se o consumidor pessoa física
optar pelo foro do seu domicílio**, conforme garantido pelo CDC.

## 12. Contato

Dúvidas sobre estes Termos? Escreva para **${LEGAL_CONTACT_EMAIL}**.

---

${COMPANY_NAME} · CNPJ ${COMPANY_CNPJ} · Produto ${PRODUCT_NAME}
`;

export default function TermosPage() {
  return <LegalDocument title="Termos de Uso" markdown={TERMOS_MD} />;
}
