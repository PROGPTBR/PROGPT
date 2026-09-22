import { NextResponse } from "next/server";

import {
  getServerSupabase,
  getSignupSupabase,
} from "@/lib/db/supabase";

import {
  createAsaasCustomer,
  createAsaasSubscription,
  deleteAsaasCustomer,
  AsaasError,
} from "@/lib/billing/asaas";

import { getBillingSettings } from "@/lib/billing/settings";

import {
  parseSeats,
  seatsTotal,
  seatsLabel,
  seatsChargeSummary,
  normalizeSeatEmails,
} from "@/lib/billing/seats";

import { provisionSeatsFromSignup } from "@/lib/billing/seat-members";

import {
  isValidCpf,
  formatCpf,
} from "@/lib/validators/cpf";

import {
  isValidCnpj,
} from "@/lib/validators/cnpj";

import {
  verifyTurnstileToken,
  getClientIp,
} from "@/lib/captcha";

function originFrom(req: Request): string {
  const url = new URL(req.url);

  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  console.log("==================================");
  console.log(`[${requestId}] POST /api/signup`);
  console.log(new Date().toISOString());
  console.log("==================================");

  const supabase = getServerSupabase();
  const signup = getSignupSupabase();

  let userId: string | null = null;
  let customerId: string | null = null;

  try {
    const body = await req.json();

    console.log(`[${requestId}] payload recebido`);

    // =======================================================
    // CAPTCHA
    // =======================================================

    const token = body.turnstileToken;

    if (!token) {
      return NextResponse.json(
        {
          error: "captcha_required",
          message: "Confirme que você não é um robô.",
        },
        {
          status: 400,
        },
      );
    }

    const ip = getClientIp(req);

    const valid =
      await verifyTurnstileToken(
        token,
        ip,
      );

    if (!valid) {
      return NextResponse.json(
        {
          error: "captcha_invalid",
          message:
            "Não foi possível validar a verificação de segurança. Tente novamente.",
        },
        {
          status: 400,
        },
      );
    }

    console.log(
      `[${requestId}] ✅ Captcha validado`,
    );

    // =======================================================
    // VALIDAÇÃO CPF / CNPJ
    // =======================================================

    const personType =
      body.personType === "pj"
        ? "pj"
        : "pf";

    const documentDigits =
      String(body.cpf ?? "")
        .replace(/\D/g, "");

    if (!documentDigits) {
      return NextResponse.json(
        {
          error:
            personType === "pj"
              ? "invalid_cnpj"
              : "invalid_cpf",

          message:
            personType === "pj"
              ? "Informe um CNPJ válido."
              : "Informe um CPF válido.",
        },
        {
          status: 400,
        },
      );
    }

    if (personType === "pj") {
      if (!isValidCnpj(documentDigits)) {
        return NextResponse.json(
          {
            error: "invalid_cnpj",

            message:
              "CNPJ inválido. Verifique o número informado e tente novamente.",
          },
          {
            status: 400,
          },
        );
      }
    } else {
      const cpf =
        formatCpf(documentDigits);

      if (!isValidCpf(cpf)) {
        return NextResponse.json(
          {
            error: "invalid_cpf",

            message:
              "CPF inválido. Verifique o número informado e tente novamente.",
          },
          {
            status: 400,
          },
        );
      }
    }

    console.log(
      `[${requestId}] ✅ Documento validado`,
    );

    // =======================================================
    // VALIDAÇÕES BÁSICAS
    // =======================================================

    if (!body.email) {
      return NextResponse.json(
        {
          error: "invalid_email",
          message:
            "Informe um endereço de e-mail válido.",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.password) {
      return NextResponse.json(
        {
          error: "invalid_password",
          message:
            "Informe uma senha válida.",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.fullName) {
      return NextResponse.json(
        {
          error: "invalid_name",
          message:
            "Informe seu nome completo.",
        },
        {
          status: 400,
        },
      );
    }

    if (!body.cardHolder) {
      return NextResponse.json(
        {
          error: "invalid_card_holder",

          message:
            "Informe o nome do titular do cartão.",
        },
        {
          status: 400,
        },
      );
    }

    // =======================================================
    // CRIA USUÁRIO NO SUPABASE
    // =======================================================

    const {
      data,
      error,
    } =
      await signup.auth.signUp({
        email:
          body.email,

        password:
          body.password,

        options: {
          emailRedirectTo:
            `${originFrom(req)}/auth/callback?next=/chat`,

          captchaToken:
            body.turnstileToken,
        },
      });

    if (error) {
      const message =
        error.message.toLowerCase();

      if (
        message.includes("already") ||
        message.includes("registered") ||
        message.includes("exists") ||
        message.includes("duplicate")
      ) {
        return NextResponse.json(
          {
            alreadyExists: true,

            error:
              "email_already_registered",

            message:
              "Já existe uma conta cadastrada com este e-mail.",
          },
          {
            status: 400,
          },
        );
      }

      return NextResponse.json(
        {
          error:
            "signup_failed",

          message:
            error.message ||
            "Não foi possível criar sua conta.",
        },
        {
          status: 400,
        },
      );
    }

    console.log(
      `[${requestId}] ✅ Signup Supabase executado`,
    );

    if (!data.user) {
      throw new Error(
        "Usuário não foi criado.",
      );
    }

    userId =
      data.user.id;

    console.log(
      `[${requestId}] ✅ Usuário criado`,
    );

    console.log(
      `[${requestId}] User ID: ${userId}`,
    );

    // =======================================================
    // CRIA CLIENTE NO ASAAS
    // =======================================================

    const customer =
      await createAsaasCustomer({
        name:
          body.fullName,

        email:
          body.email,

        cpfCnpj:
          documentDigits,

        mobilePhone:
          String(
            body.phone ?? "",
          ).replace(
            /\D/g,
            "",
          ),

        company:
          body.companyName ||
          undefined,
      });

    customerId =
      customer.id;

    console.log(
      `[${requestId}] ✅ Cliente criado no Asaas (id ${customer.id})`,
    );

    // =======================================================
    // ATUALIZA PROFILE
    // =======================================================

    const {
      error:
        profileError,
    } =
      await supabase
        .from("profiles")
        .update({
          full_name:
            body.fullName,

          cpf_cnpj:
            documentDigits,

          phone:
            String(
              body.phone ?? "",
            ).replace(
              /\D/g,
              "",
            ),

          company_name:
            body.companyName ||
            null,

          professional_requirement:
            body.position ||
            null,

          role:
            "user",

          plan:
            "trial",

          subscription_status:
            "trial",
        })
        .eq(
          "id",
          data.user.id,
        );

    if (profileError) {
      throw profileError;
    }

    console.log(
      `[${requestId}] ✅ Profile atualizado`,
    );

    // =======================================================
    // BILLING
    // =======================================================

    const billing =
      await getBillingSettings();

    const seats =
      parseSeats(
        body.seats,
      );

    const seatEmails =
      normalizeSeatEmails(
        body.seatEmails,
        seats,
      );

    const monthlyTotal =
      seatsTotal(
        billing.planPrice,
        seats,
      );

    console.log(
      `[${requestId}] Assinatura para ${seats} usuário(s)`,
    );

    // =======================================================
    // PRIMEIRA COBRANÇA
    // =======================================================

    const nextDueDate =
      new Date();

    nextDueDate.setDate(
      nextDueDate.getDate() +
        billing.trialDays,
    );

    const nextDueDateString =
      nextDueDate
        .toISOString()
        .substring(
          0,
          10,
        );

    // =======================================================
    // IP
    // =======================================================

    const forwardedFor =
      req.headers.get(
        "x-forwarded-for",
      );

    const remoteIp =
      forwardedFor
        ?.split(",")[0]
        ?.trim() ||
      req.headers.get(
        "x-real-ip",
      ) ||
      "127.0.0.1";

    // =======================================================
    // CARTÃO
    // =======================================================

    const [
      month,
      year,
    ] =
      String(
        body.cardExpiry ?? "",
      ).split("/");

    if (
      !month ||
      !year
    ) {
      return NextResponse.json(
        {
          error:
            "invalid_card_expiry",

          message:
            "Informe uma validade de cartão válida.",
        },
        {
          status: 400,
        },
      );
    }

    console.log(
      `[${requestId}] Criando assinatura (venc. ${nextDueDateString})...`,
    );

    // =======================================================
    // CRIA ASSINATURA ASAAS
    // =======================================================

    const subscription =
      await createAsaasSubscription({
        customerId:
          customer.id,

        value:
          monthlyTotal,

        cycle:
          "MONTHLY",

        billingType:
          "CREDIT_CARD",

        description:
          `Plano PRO - APP 2BSUPPLY (${seatsLabel(seats)} · ${seatsChargeSummary(
            billing.planPrice,
            seats,
          )})`,

        nextDueDate:
          nextDueDateString,

        creditCard: {
          holderName:
            body.cardHolder,

          number:
            String(
              body.cardNumber ?? "",
            ).replace(
              /\s/g,
              "",
            ),

          expiryMonth:
            month.padStart(
              2,
              "0",
            ),

          expiryYear:
            `20${year}`,

          ccv:
            body.cardCvv,
        },

        creditCardHolderInfo: {
          // IMPORTANTE:
          // usa o mesmo nome digitado no campo
          // "Nome impresso no cartão".
          name:
            body.cardHolder,

          email:
            body.email,

          cpfCnpj:
            documentDigits,

          postalCode:
            String(
              body.postalCode ?? "",
            ).replace(
              /\D/g,
              "",
            ),

          addressNumber:
            body.addressNumber,

          phone:
            String(
              body.phone ?? "",
            ).replace(
              /\D/g,
              "",
            ),

          mobilePhone:
            String(
              body.phone ?? "",
            ).replace(
              /\D/g,
              "",
            ),
        },

        remoteIp,
      });

    console.log(
      `[${requestId}] ✅ Assinatura criada (id ${subscription.id})`,
    );

    // =======================================================
    // GRAVA IDS ASAAS
    // =======================================================

    const {
      error:
        asaasProfileError,
    } =
      await supabase
        .from("profiles")
        .update({
          asaas_customer_id:
            customer.id,

          asaas_subscription_id:
            subscription.id,
        })
        .eq(
          "id",
          data.user.id,
        );

    if (
      asaasProfileError
    ) {
      throw asaasProfileError;
    }

    console.log(
      `[${requestId}] ✅ IDs do Asaas gravados no Supabase`,
    );

    // =======================================================
    // ASSINATURA LOCAL
    // =======================================================

    const trialEndIso =
      new Date(
        `${nextDueDateString}T00:00:00.000Z`,
      ).toISOString();

    const {
      error:
        subscriptionRowError,
    } =
      await supabase
        .from(
          "subscriptions",
        )
        .upsert(
          {
            user_id:
              data.user.id,

            asaas_customer_id:
              customer.id,

            asaas_subscription_id:
              subscription.id,

            status:
              "trialing",

            plan:
              "pro",

            seats,

            seat_emails:
              seatEmails,

            payment_method:
              "credit_card",

            current_period_start:
              null,

            current_period_end:
              null,

            trial_end:
              trialEndIso,

            cancel_at_period_end:
              false,

            cancelled_at:
              null,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "user_id",
          },
        );

    if (
      subscriptionRowError
    ) {
      throw subscriptionRowError;
    }

    console.log(
      `[${requestId}] ✅ Assinatura local (trialing) criada`,
    );

    // =======================================================
    // PROVISIONA ACESSOS EXTRAS
    // =======================================================

    if (
      seatEmails.length > 0
    ) {
      void provisionSeatsFromSignup({
        ownerId:
          data.user.id,

        ownerEmail:
          body.email ??
          null,

        ownerName:
          body.fullName ??
          null,

        emails:
          seatEmails,
      });
    }

    console.log(
      `[${requestId}] 🎉 Signup finalizado com sucesso`,
    );

    return NextResponse.json({
      success:
        true,

      user:
        data.user,
    });
  } catch (
    err: unknown
  ) {
    // =======================================================
    // ROLLBACK ASAAS
    // =======================================================

    if (customerId) {
      try {
        await deleteAsaasCustomer(
          customerId,
        );

        console.log(
          `[${requestId}] 🗑️ Rollback Asaas realizado.`,
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Erro ao remover cliente Asaas:",
          rollbackError,
        );
      }
    }

    // =======================================================
    // ROLLBACK SUPABASE
    // =======================================================

    if (userId) {
      try {
        await supabase.auth.admin.deleteUser(
          userId,
        );

        console.log(
          `[${requestId}] 🗑️ Rollback Supabase realizado.`,
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Erro ao remover usuário:",
          rollbackError,
        );
      }
    }

    console.error(
      "############################",
    );

    console.error(
      "ERRO NO SIGNUP",
    );

    console.error(err);

    if (
      err instanceof Error
    ) {
      console.error(
        err.message,
      );

      console.error(
        err.stack,
      );
    }

    console.error(
      "############################",
    );

    // =======================================================
    // ERRO ASAAS
    // =======================================================

    if (
      err instanceof AsaasError
    ) {
      const asaasMessage =
        err.description ??
        "";

      const lower =
        asaasMessage.toLowerCase();

      let errorCode =
        "payment_failed";

      let friendlyMessage =
        asaasMessage ||
        "Não foi possível processar o pagamento com este cartão. Confira os dados ou tente outro cartão.";

      if (
        lower.includes("recus") ||
        lower.includes(
          "não autorizado",
        ) ||
        lower.includes(
          "nao autorizado",
        )
      ) {
        errorCode =
          "card_declined";

        friendlyMessage =
          "O cartão não foi autorizado. Verifique os dados ou tente outro cartão.";
      }

      if (
        lower.includes(
          "cartão inválido",
        ) ||
        lower.includes(
          "cartao invalido",
        ) ||
        lower.includes(
          "número de cartão",
        ) ||
        lower.includes(
          "numero de cartao",
        )
      ) {
        errorCode =
          "invalid_card";

        friendlyMessage =
          "O número do cartão é inválido. Verifique os dados e tente novamente.";
      }

      if (
        lower.includes("titular") ||
        lower.includes(
          "holder",
        ) ||
        lower.includes(
          "nome do cartão",
        ) ||
        lower.includes(
          "nome do cartao",
        )
      ) {
        errorCode =
          "invalid_card_holder";

        friendlyMessage =
          "Não foi possível validar o nome do titular do cartão. Verifique o nome impresso no cartão.";
      }

      if (
        lower.includes("cpf") ||
        lower.includes("cnpj")
      ) {
        errorCode =
          "invalid_document";

        friendlyMessage =
          "O CPF ou CNPJ informado não foi aceito. Verifique o documento e tente novamente.";
      }

      return NextResponse.json(
        {
          error:
            errorCode,

          message:
            friendlyMessage,
        },
        {
          status: 400,
        },
      );
    }

    // =======================================================
    // ERRO INTERNO
    // =======================================================

    return NextResponse.json(
      {
        error:
          "signup_failed",

        message:
          err instanceof Error
            ? err.message
            : "Não foi possível concluir o cadastro. Tente novamente.",
      },
      {
        status: 500,
      },
    );
  }
}