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

  billingType:
    | 'CREDIT_CARD'
    | 'PIX'
    | 'BOLETO'
    | 'UNDEFINED';

  description: string;

  nextDueDate: string;

  callback?: {
    successUrl: string;
    autoRedirect: boolean;
  };

  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };

  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;

    postalCode: string;
    addressNumber: string;
    addressComplement?: string;

    phone: string;
    mobilePhone?: string;
  };

  /**
   * IP REAL do dispositivo do pagador.
   * Deve ser enviado no nível principal da requisição Asaas.
   */
  remoteIp?: string;

  /**
   * Checkout interno não precisa buscar invoiceUrl.
   * O checkout antigo continua usando invoiceUrl normalmente.
   */
  skipInvoiceUrlLookup?: boolean;
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
  // Config administrável (billing_settings) com fallback no env.
  const { getBillingSettings } = await import('./settings');

  const { apiKey, apiUrl } =
    await getBillingSettings();

  if (!apiKey) {
    throw new Error(
      'Asaas API key não configurada (billing_settings ou ASAAS_API_KEY env)',
    );
  }

  return {
    apiKey,
    apiUrl,
  };
}

async function asaasFetch<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { apiKey, apiUrl } =
    await getConfig();

  const res = await fetch(
    `${apiUrl}${path}`,
    {
      method,

      headers: {
        access_token: apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'PROGPT/1.0',
      },

      body: body
        ? JSON.stringify(body)
        : undefined,

      /**
       * Asaas recomenda timeout mínimo de 60 segundos
       * para operações de cartão.
       */
      signal: AbortSignal.timeout(65000),
    },
  );

  const text = await res.text();

  let parsed: unknown;

  try {
    parsed = text
      ? JSON.parse(text)
      : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    /**
     * NÃO registrar body da requisição aqui.
     *
     * Principalmente porque operações com cartão
     * possuem número e CVV.
     */
    console.error(
      `[Asaas] ${method} ${path} retornou ${res.status}`,
    );

    console.error(
      '[Asaas] Resposta:',
      parsed,
    );

    throw new AsaasError(
      `Asaas ${method} ${path} failed: ${res.status}`,
      res.status,
      parsed,
    );
  }

  return parsed as T;
}

/**
 * Cria customer no Asaas.
 */
export async function createAsaasCustomer(
  input: {
    name: string;
    email: string;
    cpfCnpj: string;

    mobilePhone?: string;
    phone?: string;
    company?: string;

    postalCode?: string;
    address?: string;
    addressNumber?: string;
    province?: string;
    city?: string;
  },
): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>(
    'POST',
    '/customers',
    input,
  );
}

/**
 * Cria assinatura recorrente.
 *
 * Pode funcionar de duas formas:
 *
 * 1. Hosted checkout antigo:
 *    - sem cartão
 *    - busca invoiceUrl
 *
 * 2. Checkout interno PROGPT:
 *    - envia creditCard
 *    - envia creditCardHolderInfo
 *    - envia remoteIp
 *    - skipInvoiceUrlLookup = true
 */
export async function createAsaasSubscription(
  input: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> {
  const body: Record<string, unknown> = {
    customer: input.customerId,
    value: input.value,
    cycle: input.cycle,
    billingType: input.billingType,
    description: input.description,
    nextDueDate: input.nextDueDate,

    ...(input.creditCard && {
      creditCard:
        input.creditCard,
    }),

    ...(input.creditCardHolderInfo && {
      creditCardHolderInfo:
        input.creditCardHolderInfo,
    }),

    ...(input.remoteIp && {
      remoteIp: input.remoteIp,
    }),

    ...(input.callback && {
      callback: {
        successUrl:
          input.callback.successUrl,

        autoRedirect:
          input.callback.autoRedirect,
      },
    }),
  };

  /**
   * IMPORTANTE:
   * jamais fazer console.log(body).
   *
   * body pode conter:
   * - número do cartão
   * - CVV
   * - CPF
   */
  console.log(
    '[Asaas] Criando assinatura:',
    {
      customer:
        input.customerId,

      value:
        input.value,

      cycle:
        input.cycle,

      billingType:
        input.billingType,

      nextDueDate:
        input.nextDueDate,

      hasCreditCard:
        !!input.creditCard,

      hasRemoteIp:
        !!input.remoteIp,

      internalCheckout:
        !!input.skipInvoiceUrlLookup,
    },
  );

  const result =
    await asaasFetch<{
      id: string;
      invoiceUrl?: string;
      paymentLink?: string;
    }>(
      'POST',
      '/subscriptions',
      body,
    );

  /**
   * Checkout interno:
   *
   * Já enviamos o cartão junto da criação,
   * portanto não precisamos buscar invoiceUrl.
   */
  if (
    input.skipInvoiceUrlLookup
  ) {
    return {
      id: result.id,
      invoiceUrl: '',
      paymentLink:
        result.paymentLink ??
        null,
    };
  }

  /**
   * Checkout hospedado antigo.
   */
  let invoiceUrl =
    result.invoiceUrl ??
    result.paymentLink ??
    '';

  if (!invoiceUrl) {
    invoiceUrl =
      await fetchSubscriptionInvoiceUrl(
        result.id,
      );
  }

  return {
    id: result.id,
    invoiceUrl,
    paymentLink:
      result.paymentLink ??
      null,
  };
}

/**
 * Busca invoiceUrl da primeira cobrança.
 * Usado somente no checkout hospedado antigo.
 */
async function fetchSubscriptionInvoiceUrl(
  subscriptionId: string,
): Promise<string> {
  for (
    let attempt = 0;
    attempt < 4;
    attempt++
  ) {
    try {
      const pays =
        await asaasFetch<{
          data?: Array<{
            invoiceUrl?: string;
          }>;
        }>(
          'GET',
          `/subscriptions/${subscriptionId}/payments`,
        );

      const url =
        pays.data?.[0]
          ?.invoiceUrl;

      if (url) {
        return url;
      }
    } catch (err) {
      console.warn(
        '[Asaas] Erro ao buscar cobrança da assinatura:',
        err,
      );
    }

    if (attempt < 3) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            900,
          ),
      );
    }
  }

  return '';
}

/**
 * Cancela assinatura.
 */
export async function cancelAsaasSubscription(
  subscriptionId: string,
): Promise<void> {
  await asaasFetch(
    'DELETE',
    `/subscriptions/${subscriptionId}`,
  );
}

/**
 * Recupera estado da assinatura.
 */
export async function getAsaasSubscription(
  subscriptionId: string,
): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(
    'GET',
    `/subscriptions/${subscriptionId}`,
  );
}

export async function createAsaasPaymentLink(
  input: {
    name: string;
    value: number;
    description: string;
  },
): Promise<{
  id: string;
  url: string;
}> {
  const result =
    await asaasFetch<{
      id: string;
      url: string;
    }>(
      'POST',
      '/paymentLinks',
      {
        name: input.name,

        billingType:
          'UNDEFINED',

        chargeType:
          'RECURRENT',

        value:
          input.value,

        description:
          input.description,

        dueDateLimitDays: 3,
      },
    );

  return {
    id: result.id,
    url: result.url,
  };
}

export {
  AsaasError,
};

export async function deleteAsaasCustomer(
  customerId: string,
): Promise<void> {
  await asaasFetch(
    'DELETE',
    `/customers/${customerId}`,
  );
}