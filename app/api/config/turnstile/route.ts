import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TEST_SITE_KEY_PREFIXES = ['1x', '2x', '3x'];

export async function GET() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  if (!siteKey || TEST_SITE_KEY_PREFIXES.some((prefix) => siteKey.startsWith(prefix))) {
    return NextResponse.json(
      { error: 'turnstile_not_configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { siteKey },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
