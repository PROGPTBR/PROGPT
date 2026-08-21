'use client';

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from 'react';

import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

import {
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  createBrowserClient,
} from '@supabase/ssr';

import { Header } from '@/app/login/header';

// ============================================================
// ESTILOS
// ============================================================

const INPUT =
  'w-full h-11 rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60';

const LABEL =
  'mb-1.5 block text-xs font-medium text-muted-foreground';

// ============================================================
// HELPERS
// ============================================================

function onlyNumbers(value: string) {
  return value.replace(/\D/g, '');
}

function maskCPF(value: string) {
  return onlyNumbers(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(
      /(\d{3})(\d{1,2})$/,
      '$1-$2',
    );
}

function maskPhone(value: string) {
  const numbers =
    onlyNumbers(value).slice(0, 11);

  if (numbers.length <= 2) {
    return numbers;
  }

  if (numbers.length <= 6) {
    return numbers.replace(
      /^(\d{2})(\d+)/,
      '($1) $2',
    );
  }

  if (numbers.length <= 10) {
    return numbers.replace(
      /^(\d{2})(\d{4})(\d+)/,
      '($1) $2-$3',
    );
  }

  return numbers.replace(
    /^(\d{2})(\d{5})(\d+)/,
    '($1) $2-$3',
  );
}

function maskCard(value: string) {
  return onlyNumbers(value)
    .slice(0, 19)
    .replace(
      /(\d{4})(?=\d)/g,
      '$1 ',
    );
}

function maskExpiry(value: string) {
  const numbers =
    onlyNumbers(value).slice(0, 4);

  if (numbers.length <= 2) {
    return numbers;
  }

  return `${numbers.slice(
    0,
    2,
  )}/${numbers.slice(2)}`;
}

function maskCep(value: string) {
  return onlyNumbers(value)
    .slice(0, 8)
    .replace(
      /(\d{5})(\d)/,
      '$1-$2',
    );
}

// ============================================================
// PAGE
// ============================================================

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

// ============================================================
// CHECKOUT
// ============================================================

function CheckoutContent() {
  const router = useRouter();

  const searchParams =
    useSearchParams();

  const planSlug =
    searchParams.get('plan') ||
    'pf-73';

  // ==========================================================
  // ESTADOS GERAIS
  // ==========================================================

  const [busy, setBusy] =
    useState(false);

  const [
    loadingProfile,
    setLoadingProfile,
  ] = useState(true);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [success, setSuccess] =
    useState<string | null>(
      null,
    );

  const [
    profileLoaded,
    setProfileLoaded,
  ] = useState(false);

  // ==========================================================
  // DADOS DO TITULAR
  // ==========================================================

  const [name, setName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [cpf, setCpf] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [
    postalCode,
    setPostalCode,
  ] = useState('');

  const [
    addressNumber,
    setAddressNumber,
  ] = useState('');

  // ==========================================================
  // CARTÃO
  // ==========================================================

  const [
    holderName,
    setHolderName,
  ] = useState('');

  const [
    cardNumber,
    setCardNumber,
  ] = useState('');

  const [expiry, setExpiry] =
    useState('');

  const [cvv, setCvv] =
    useState('');

  // ==========================================================
  // PLANO
  // ==========================================================

  const isBuyerPlan =
    planSlug === 'pf-73';

  // ==========================================================
  // CARREGA DADOS DO USUÁRIO
  //
  // Nome       → profiles.full_name
  // CPF        → profiles.cpf_cnpj
  // Telefone   → profiles.phone
  // E-mail     → Supabase Auth
  //
  // CEP e número não estão salvos no profiles atualmente.
  // ==========================================================

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoadingProfile(true);

      try {
        const supabaseUrl =
          process.env
            .NEXT_PUBLIC_SUPABASE_URL;

        const supabaseKey =
          process.env
            .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env
            .NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (
          !supabaseUrl ||
          !supabaseKey
        ) {
          console.error(
            '[checkout] configuração pública do Supabase não encontrada',
          );

          if (active) {
            setLoadingProfile(
              false,
            );
          }

          return;
        }

        const supabase =
          createBrowserClient(
            supabaseUrl,
            supabaseKey,
          );

        // ------------------------------------------------------
        // USUÁRIO AUTENTICADO
        // ------------------------------------------------------

        const {
          data: userData,
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !userData.user
        ) {
          if (active) {
            router.replace(
              `/login?next=${encodeURIComponent(
                `/account/billing/checkout?plan=${planSlug}`,
              )}`,
            );
          }

          return;
        }

        const user =
          userData.user;

        // ------------------------------------------------------
        // E-MAIL
        // ------------------------------------------------------

        if (
          active &&
          user.email
        ) {
          setEmail(user.email);
        }

        // ------------------------------------------------------
        // PROFILE
        // ------------------------------------------------------

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select(
            `
              full_name,
              cpf_cnpj,
              phone
            `,
          )
          .eq(
            'id',
            user.id,
          )
          .maybeSingle();

        if (profileError) {
          console.error(
            '[checkout] não foi possível carregar o perfil',
          );

          return;
        }

        if (
          !active ||
          !profile
        ) {
          return;
        }

        // ------------------------------------------------------
        // PREENCHE CAMPOS
        // ------------------------------------------------------

        if (
          profile.full_name
        ) {
          setName(
            profile.full_name,
          );
        }

        if (
          profile.cpf_cnpj
        ) {
          setCpf(
            maskCPF(
              profile.cpf_cnpj,
            ),
          );
        }

        if (profile.phone) {
          setPhone(
            maskPhone(
              profile.phone,
            ),
          );
        }

        setProfileLoaded(true);
      } catch {
        console.error(
          '[checkout] erro ao carregar dados do usuário',
        );
      } finally {
        if (active) {
          setLoadingProfile(
            false,
          );
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [
    planSlug,
    router,
  ]);

  // ==========================================================
  // ENVIO
  // ==========================================================

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!isBuyerPlan) {
      setError(
        'O plano selecionado não é válido.',
      );

      return;
    }

    const cleanCard =
      onlyNumbers(cardNumber);

    const cleanCpf =
      onlyNumbers(cpf);

    const cleanPhone =
      onlyNumbers(phone);

    const cleanPostalCode =
      onlyNumbers(postalCode);

    const cleanCvv =
      onlyNumbers(cvv);

    const [
      expiryMonth,
      expiryYearShort,
    ] = expiry.split('/');

    // ========================================================
    // VALIDAÇÃO
    // ========================================================

    if (
      !name.trim() ||
      !email.trim() ||
      cleanCpf.length !== 11 ||
      cleanPhone.length < 10 ||
      cleanPostalCode.length !==
        8 ||
      !addressNumber.trim() ||
      !holderName.trim() ||
      cleanCard.length < 13 ||
      expiryMonth?.length !==
        2 ||
      expiryYearShort?.length !==
        2 ||
      cleanCvv.length < 3
    ) {
      setError(
        'Preencha todos os dados corretamente para continuar.',
      );

      return;
    }

    const month =
      Number(expiryMonth);

    if (
      month < 1 ||
      month > 12
    ) {
      setError(
        'Informe uma validade de cartão válida.',
      );

      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const expiryYear =
        `20${expiryYearShort}`;

      const response =
        await fetch(
          '/api/billing/subscribe',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify(
              {
                plan:
                  planSlug,

                customer: {
                  name:
                    name.trim(),

                  email:
                    email.trim(),

                  cpfCnpj:
                    cleanCpf,

                  phone:
                    cleanPhone,

                  postalCode:
                    cleanPostalCode,

                  addressNumber:
                    addressNumber.trim(),
                },

                creditCard: {
                  holderName:
                    holderName.trim(),

                  number:
                    cleanCard,

                  expiryMonth,

                  expiryYear,

                  ccv:
                    cleanCvv,
                },
              },
            ),
          },
        );

      const body =
        await response.json();

      // ========================================================
      // ERRO
      // ========================================================

      if (!response.ok) {
        if (
          response.status ===
          401
        ) {
          router.push(
            `/login?next=${encodeURIComponent(
              `/account/billing/checkout?plan=${planSlug}`,
            )}`,
          );

          return;
        }

        setError(
          body?.message ||
            body?.error ||
            'Não foi possível concluir a assinatura.',
        );

        return;
      }

      // ========================================================
      // PAGAMENTO JÁ CONFIRMADO
      // ========================================================

      if (
        body?.accessGranted
      ) {
        setSuccess(
          'Pagamento confirmado! Seu acesso ao PROGPT foi liberado.',
        );

        return;
      }

      // ========================================================
      // AGUARDANDO WEBHOOK
      // ========================================================

      setSuccess(
        body?.message ||
          'Pagamento enviado com sucesso. Estamos confirmando sua assinatura.',
      );
    } catch {
      setError(
        'Não foi possível conectar ao serviço de pagamento. Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }

  // ==========================================================
  // PLANO INVÁLIDO
  // ==========================================================

  if (!isBuyerPlan) {
    return (
      <>
        <Header />

        <main className="min-h-screen bg-background text-foreground pt-24 px-4">
          <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center">
            <h1 className="text-2xl font-bold">
              Plano não encontrado
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              O plano selecionado não
              está disponível.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  '/planos',
                )
              }
              className="mt-6 rounded-full bg-brand-gradient px-6 py-3 text-sm font-semibold text-black"
            >
              Voltar para os planos
            </button>
          </div>
        </main>
      </>
    );
  }

  // ==========================================================
  // CHECKOUT
  // ==========================================================

  return (
    <>
      <Header />

      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6">

          {/* ==================================================
              VOLTAR
          ================================================== */}

          <div className="mb-8">
            <button
              type="button"
              onClick={() =>
                router.push(
                  '/planos?expired=true',
                )
              }
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-brand"
            >
              <ArrowLeft className="h-4 w-4" />

              Voltar para os planos
            </button>
          </div>

          {/* ==================================================
              TÍTULO
          ================================================== */}

          <div className="mb-10 max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/5 px-3 py-1 text-xs font-medium text-brand">
              <LockKeyhole className="h-3.5 w-3.5" />

              Checkout seguro
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Finalize sua assinatura
            </h1>

            <p className="mt-3 text-base text-muted-foreground">
              Continue usando todos os
              recursos do PROGPT sem
              interrupções.
            </p>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">

            {/* ==================================================
                FORMULÁRIO
            ================================================== */}

            <form
              id="checkout-form"
              onSubmit={
                handleSubmit
              }
              className="space-y-6"
            >

              {/* =================================================
                  DADOS DO TITULAR
              ================================================= */}

              <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                <div className="mb-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                    Etapa 1
                  </span>

                  <h2 className="mt-1 text-xl font-semibold">
                    Dados do titular
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Confira os dados do
                    responsável pela
                    assinatura.
                  </p>

                  {/* CARREGANDO PERFIL */}

                  {loadingProfile && (
                    <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />

                      Carregando dados
                      da sua conta...
                    </div>
                  )}

                  {/* DADOS CARREGADOS */}

                  {!loadingProfile &&
                    profileLoaded && (
                      <div className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" />

                        Dados da sua
                        conta preenchidos
                        automaticamente
                      </div>
                    )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">

                  {/* NOME */}

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="name"
                      className={
                        LABEL
                      }
                    >
                      Nome completo
                    </label>

                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(
                        e,
                      ) =>
                        setName(
                          e.target
                            .value,
                        )
                      }
                      placeholder="Seu nome completo"
                      autoComplete="name"
                      required
                      disabled={
                        loadingProfile
                      }
                      className={
                        INPUT
                      }
                    />
                  </div>

                  {/* CPF */}

                  <div>
                    <label
                      htmlFor="cpf"
                      className={
                        LABEL
                      }
                    >
                      CPF
                    </label>

                    <input
                      id="cpf"
                      type="text"
                      value={cpf}
                      onChange={(
                        e,
                      ) =>
                        setCpf(
                          maskCPF(
                            e.target
                              .value,
                          ),
                        )
                      }
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      disabled={
                        loadingProfile
                      }
                      className={
                        INPUT
                      }
                    />
                  </div>

                  {/* TELEFONE */}

                  <div>
                    <label
                      htmlFor="phone"
                      className={
                        LABEL
                      }
                    >
                      Telefone
                    </label>

                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(
                        e,
                      ) =>
                        setPhone(
                          maskPhone(
                            e.target
                              .value,
                          ),
                        )
                      }
                      placeholder="(21) 99999-9999"
                      autoComplete="tel"
                      required
                      disabled={
                        loadingProfile
                      }
                      className={
                        INPUT
                      }
                    />
                  </div>

                  {/* EMAIL */}

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="email"
                      className={
                        LABEL
                      }
                    >
                      E-mail
                    </label>

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(
                        e,
                      ) =>
                        setEmail(
                          e.target
                            .value,
                        )
                      }
                      placeholder="seu@email.com"
                      autoComplete="email"
                      required
                      disabled={
                        loadingProfile
                      }
                      className={
                        INPUT
                      }
                    />
                  </div>

                  {/* CEP */}

                  <div>
                    <label
                      htmlFor="postalCode"
                      className={
                        LABEL
                      }
                    >
                      CEP
                    </label>

                    <input
                      id="postalCode"
                      type="text"
                      value={
                        postalCode
                      }
                      onChange={(
                        e,
                      ) =>
                        setPostalCode(
                          maskCep(
                            e.target
                              .value,
                          ),
                        )
                      }
                      placeholder="00000-000"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      required
                      className={
                        INPUT
                      }
                    />
                  </div>

                  {/* NÚMERO */}

                  <div>
                    <label
                      htmlFor="addressNumber"
                      className={
                        LABEL
                      }
                    >
                      Número
                    </label>

                    <input
                      id="addressNumber"
                      type="text"
                      value={
                        addressNumber
                      }
                      onChange={(
                        e,
                      ) =>
                        setAddressNumber(
                          e.target
                            .value,
                        )
                      }
                      placeholder="123"
                      required
                      className={
                        INPUT
                      }
                    />
                  </div>
                </div>
              </section>

              {/* =================================================
                  CARTÃO
              ================================================= */}

              <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                <div className="mb-6 flex items-start justify-between gap-4">

                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                      Etapa 2
                    </span>

                    <h2 className="mt-1 text-xl font-semibold">
                      Pagamento
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Informe os dados
                      do cartão.
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <CreditCard className="h-5 w-5" />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">

                  {/* NOME CARTÃO */}

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="holderName"
                      className={
                        LABEL
                      }
                    >
                      Nome impresso no
                      cartão
                    </label>

                    <input
                      id="holderName"
                      type="text"
                      value={
                        holderName
                      }
                      onChange={(
                        e,
                      ) =>
                        setHolderName(
                          e.target
                            .value,
                        )
                      }
                      placeholder="NOME COMO ESTÁ NO CARTÃO"
                      autoComplete="cc-name"
                      required
                      className={
                        INPUT
                      }
                    />
                  </div>

                  {/* NÚMERO CARTÃO */}

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="cardNumber"
                      className={
                        LABEL
                      }
                    >
                      Número do cartão
                    </label>

                    <input
                      id="cardNumber"
                      type="text"
                      value={
                        cardNumber
                      }
                      onChange={(
                        e,
                      ) =>
                        setCardNumber(
                          maskCard(
                            e.target
                              .value,
                          ),
                        )
                      }
                      placeholder="0000 0000 0000 0000"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      required
                      className={
                        INPUT
                      }
                    />
                  </div>

                  {/* VALIDADE */}

                  <div>
                    <label
                      htmlFor="expiry"
                      className={
                        LABEL
                      }
                    >
                      Validade
                    </label>

                    <input
                      id="expiry"
                      type="text"
                      value={
                        expiry
                      }
                      onChange={(
                        e,
                      ) =>
                        setExpiry(
                          maskExpiry(
                            e.target
                              .value,
                          ),
                        )
                      }
                      placeholder="MM/AA"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      required
                      className={
                        INPUT
                      }
                    />
                  </div>

                  {/* CVV */}

                  <div>
                    <label
                      htmlFor="cvv"
                      className={
                        LABEL
                      }
                    >
                      CVV
                    </label>

                    <input
                      id="cvv"
                      type="password"
                      value={cvv}
                      onChange={(
                        e,
                      ) =>
                        setCvv(
                          onlyNumbers(
                            e.target
                              .value,
                          ).slice(
                            0,
                            4,
                          ),
                        )
                      }
                      placeholder="000"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      required
                      className={
                        INPUT
                      }
                    />
                  </div>
                </div>

                {/* SEGURANÇA */}

                <div className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Os dados do cartão
                    são usados somente
                    para processar esta
                    assinatura e não
                    são armazenados
                    pelo PROGPT.
                  </p>
                </div>
              </section>

              {/* =================================================
                  ERRO
              ================================================= */}

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* =================================================
                  SUCESSO
              ================================================= */}

              {success && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-700 dark:text-emerald-400">
                  <div className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />

                    <span>
                      {success}
                    </span>
                  </div>
                </div>
              )}

              {/* =================================================
                  BOTÃO MOBILE
              ================================================= */}

              <button
                type="submit"
                disabled={
                  busy ||
                  loadingProfile
                }
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 text-sm font-semibold text-black transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 lg:hidden"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />

                    Processando...
                  </>
                ) : (
                  <>
                    Assinar por R$
                    73,00/mês
                  </>
                )}
              </button>
            </form>

            {/* ==================================================
                RESUMO
            ================================================== */}

            <aside className="lg:sticky lg:top-24">
              <div className="rounded-3xl border-2 border-brand bg-card p-6 shadow-[0_24px_60px_-22px_rgba(14,141,225,0.35)]">

                <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Plano selecionado
                </span>

                <h2 className="mt-2 text-2xl font-bold">
                  Plano Comprador
                  Estratégico
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Continue usando
                  todos os recursos
                  do PROGPT.
                </p>

                {/* PREÇO */}

                <div className="my-6 border-y border-border py-6">
                  <div className="flex items-end justify-between">

                    <span className="text-sm text-muted-foreground">
                      Mensalidade
                    </span>

                    <div className="text-right">
                      <span className="text-3xl font-bold">
                        R$ 73,00
                      </span>

                      <span className="text-sm text-muted-foreground">
                        /mês
                      </span>
                    </div>
                  </div>
                </div>

                {/* RECURSOS */}

                <ul className="space-y-3 text-sm">
                  {[
                    'Chat especializado e ilimitado',
                    'Assistentes para processos de Suprimentos',
                    'RFI, RFQ e RFP',
                    'Análise de propostas e contratos',
                    'Leitura de PDFs e planilhas',
                    'Histórico das conversas',
                  ].map(
                    (
                      item,
                    ) => (
                      <li
                        key={
                          item
                        }
                        className="flex items-start gap-2"
                      >
                        <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand text-black">
                          <Check className="h-3 w-3" />
                        </span>

                        <span className="text-foreground/80">
                          {
                            item
                          }
                        </span>
                      </li>
                    ),
                  )}
                </ul>

                {/* BOTÃO DESKTOP */}

                <button
                  type="submit"
                  form="checkout-form"
                  disabled={
                    busy ||
                    loadingProfile
                  }
                  className="mt-7 hidden h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 text-sm font-semibold text-black transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 lg:inline-flex"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />

                      Processando...
                    </>
                  ) : (
                    'ASSINAR POR R$ 73,00/MÊS'
                  )}
                </button>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <LockKeyhole className="h-3 w-3" />

                  Pagamento protegido
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}