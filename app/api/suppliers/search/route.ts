import { NextResponse } from 'next/server';

import {
  NotAuthenticated,
  requireUser,
} from '@/lib/auth';

import {
  checkChatRateLimit,
} from '@/lib/rate-limit';

import {
  searchSuppliers,
} from '@/lib/suppliers/search';

import {
  SearchRequestSchema,
} from '@/lib/suppliers/types';

import {
  recordApiUsage,
} from '@/lib/observability/api-usage';

import {
  withUser,
} from '@/lib/observability/user-context';

export const runtime = 'nodejs';

// ============================================================
// POST /api/suppliers/search
// ============================================================

export async function POST(
  req: Request,
): Promise<Response> {
  let user;

  try {
    user =
      await requireUser();
  } catch (err) {
    if (
      err instanceof
      NotAuthenticated
    ) {
      return NextResponse.json(
        {
          error:
            'unauthorized',
        },
        {
          status: 401,
        },
      );
    }

    throw err;
  }

  return withUser(
    user.id,
    () => searchBody(req),
  );
}

// ============================================================
// PROCESSAR BUSCA
// ============================================================

async function searchBody(
  req: Request,
): Promise<Response> {
  // ==========================================================
  // RATE LIMIT
  // ==========================================================

  const limit =
    await checkChatRateLimit();

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error:
          'rate_limited',

        retry_after_secs:
          limit.retryAfterSecs,
      },
      {
        status: 429,
      },
    );
  }

  // ==========================================================
  // BODY
  // ==========================================================

  let body: unknown;

  try {
    body =
      await req.json();
  } catch {
    return NextResponse.json(
      {
        error:
          'invalid_json',
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // VALIDAÇÃO
  // ==========================================================

  const parsed =
    SearchRequestSchema.safeParse(
      body,
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          'invalid_body',

        issues:
          parsed.error.issues,
      },
      {
        status: 400,
      },
    );
  }

  // ==========================================================
  // BUSCA
  // ==========================================================

  try {
    const result =
      await searchSuppliers(
        parsed.data,
      );

    // ========================================================
    // OBSERVABILIDADE
    // ========================================================

    void recordApiUsage({
      provider:
        'openai',

      operation:
        'suppliers-search',

      metadata: {
        cnae:
          parsed.data.cnae,

        ufs_count:
          parsed.data.ufs
            ?.length ??
          0,

        cities_count:
          parsed.data.cities
            ?.length ??
          0,

        group_count:
          result.groups.length,
      },
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json(
      result,
    );
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : String(err);

    console.error(
      '[api/suppliers/search] failed:',
      msg,
    );

    return NextResponse.json(
      {
        error:
          'internal_error',
      },
      {
        status: 500,
      },
    );
  }
}