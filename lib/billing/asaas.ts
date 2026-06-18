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

function getConfig() {
  const apiKey = process.env.ASAAS_API_KEY;
  const apiUrl = process.env.ASAAS_API_URL ?? 'https://sandbox.asaas.com/api/v3';
  if (!apiKey) throw new Error('ASAAS_API_KEY env var missing');
  return { apiKey, apiUrl };
}

async function asaasFetch<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { apiKey, apiUrl } = getConfig();
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
  console.log('====================');
  console.log('ASAAS ERROR');
  console.log(parsed);
  console.log('====================');

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


  console.log('ASAAS RAW RESULT:', JSON.stringify(result, null, 2));

  // Asaas retorna `invoiceUrl` pra primeira cobrança da subscription.
  // Se vier null (caso raro), fallback pra paymentLink.
  return {
    id: result.id,
    invoiceUrl: result.invoiceUrl ?? result.paymentLink ?? '',
    paymentLink: result.paymentLink ?? null,
  };
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