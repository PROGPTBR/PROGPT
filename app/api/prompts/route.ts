import { NextResponse } from 'next/server';

import { supabaseServer } from '@/lib/db/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = supabaseServer();

    const { data, error } = await sb
      .from('prompts')
      .select(
        'id, prompt_number, title, summary, content, category, tags'
      )
      .eq('is_published', true)
      .order('category', {
        ascending: true,
      })
      .order('prompt_number', {
        ascending: true,
        nullsFirst: false,
      });

    if (error) {
      console.error(
        '[GET /api/prompts]',
        error
      );

      return NextResponse.json(
        {
          error:
            'Não foi possível carregar os prompts.',
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      prompts: data ?? [],
    });
  } catch (error) {
    console.error(
      '[GET /api/prompts]',
      error
    );

    return NextResponse.json(
      {
        error:
          'Não foi possível carregar os prompts.',
      },
      {
        status: 500,
      }
    );
  }
}