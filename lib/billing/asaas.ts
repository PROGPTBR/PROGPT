// Sub-projeto 27 — wrapper REST do Asaas.
//
// Asaas API docs: https://docs.asaas.com/reference
// Auth: header `access_token: <ASAAS_API_KEY>`
// Sandbox: ASAAS_API_URL=https://sandbox.asaas.com/api/v3
// Prod:    ASAAS_API_URL=https://www.asaas.com/api/v3

export type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  value: number;
  cycle: string;
  billingType: string;
  nextDueDate: string;
};

export type CreateSubscriptionInput = {
  customerId: string;
  value: number;
  cycle: 'MONTHLY' | 'YEARLY';
  billingType: 'CREDIT_CARD' | 'PIX' | 'BOLETO' | 'UNDEFINED';
  description: string;
  nextDueDate: string; // YYYY-MM-DD
  callback?: { successUrl: string; autoRedirect: boolean };
};

export type CreateSubscriptionResult = {
  id: string;
  invoiceUrl: string;
  paymentLink: string | null;
};

class AsaasError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = 'AsaasError';
  }
}

async function getConfig() {
  // Config administrável (billing_settings) com fallback no env. Async porque
  // lê do banco — o admin gerencia a chave/URL pelo painel /admin/billing.
  const { getBillingSettings } = await import('./settings');
  const { apiKey, apiUrl } = await getBillingSettings();
  if (!apiKey) {
    throw new Error(
      'Asaas API key não configurada (billing_settings ou ASAAS_API_KEY env)',
    );
  }
  return { apiKey, apiUrl };
}

async function asaasFetch<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { apiKey, apiUrl } = await getConfig();
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      access_token: apiKey,
      'Content-Type': 'application/json',
      // Asaas pede user-agent customizado por boas práticas
      'User-Agent': 'PROGPT/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new AsaasError(
      `Asaas ${method} ${path} failed: ${res.status} - ${JSON.stringify(parsed)}`,
      res.status,
      parsed,
    );
  }

  return parsed as T;
}

/**
 * Cria customer no Asaas. CPF é obrigatório pela API.
 * Reutilizar `customerId` existente quando user já comprou antes —
 * checar `subscriptions.asaas_customer_id` no DB antes de chamar.
 */
export async function createAsaasCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string; // só dígitos (use formatCpf)
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>('POST', '/customers', input);
}

/**
 * Cria subscription recorrente. Retorna `invoiceUrl` que é o hosted
 * checkout — redirect o user pra lá.
 *
 * v1 usa `billingType: 'UNDEFINED'` pra Asaas mostrar cartão + Pix no
 * checkout (user escolhe na hora).
 */
export async function createAsaasSubscription(

  input: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> {

  
  const body = {
    customer: input.customerId,
    value: input.value,
    cycle: input.cycle,
    billingType: input.billingType,
    description: input.description,
    nextDueDate: input.nextDueDate,
    ...(input.callback && {
      callback: {
        successUrl: input.callback.successUrl,
        autoRedirect: input.callback.autoRedirect,
      },
    }),
  };
  const result = await asaasFetch<{
    id: string;
    invoiceUrl?: string;
    paymentLink?: string;
  }>('POST', '/subscriptions', body);

  // IMPORTANTE: o `invoiceUrl` (página de checkout do cartão) vive na 1ª
  // COBRANÇA da subscription, NÃO no objeto subscription (que vem sem ele). Por
  // isso buscamos as cobranças e usamos o invoiceUrl da primeira. A cobrança é
  // gerada de forma assíncrona, então tentamos algumas vezes.
  let invoiceUrl = result.invoiceUrl ?? result.paymentLink ?? '';
  if (!invoiceUrl) {
    invoiceUrl = await fetchSubscriptionInvoiceUrl(result.id);
  }

  return {
    id: result.id,
    invoiceUrl,
    paymentLink: result.paymentLink ?? null,
  };
}

/**
 * Busca o `invoiceUrl` (checkout do cartão) da 1ª cobrança de uma subscription.
 * A cobrança é criada async pelo Asaas — retry curto até aparecer.
 */
async function fetchSubscriptionInvoiceUrl(subscriptionId: string): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const pays = await asaasFetch<{ data?: Array<{ invoiceUrl?: string }> }>(
        'GET',
        `/subscriptions/${subscriptionId}/payments`,
      );
      const url = pays.data?.[0]?.invoiceUrl;
      if (url) return url;
    } catch (err) {
      console.warn('[asaas] fetch subscription payments failed:', err);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 900));
  }
  return '';
}

/**
 * Cancela subscription. Asaas pára de gerar cobranças futuras; a
 * cobrança atual (se já paga) continua válida até `current_period_end`.
 */
export async function cancelAsaasSubscription(
  subscriptionId: string,
): Promise<void> {
  await asaasFetch('DELETE', `/subscriptions/${subscriptionId}`);
}

/**
 * Force-refresh do estado de uma subscription. Usado em caso de webhook
 * perdido — admin pode chamar /api/admin/billing/sync/:id (TODO v1.1).
 */
export async function getAsaasSubscription(
  subscriptionId: string,
): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>('GET', `/subscriptions/${subscriptionId}`);
}

export async function createAsaasPaymentLink(input: {
  name: string;
  value: number;
  description: string;
}): Promise<{
  id: string;
  url: string;
}> {
  const result = await asaasFetch<{
    id: string;
    url: string;
  }>('POST', '/paymentLinks', {
    name: input.name,
    billingType: 'UNDEFINED',
    chargeType: 'RECURRENT',
    value: input.value,
    description: input.description,

    dueDateLimitDays: 3,
  });

  return {
    id: result.id,
    url: result.url,
  };
}


export { AsaasError };