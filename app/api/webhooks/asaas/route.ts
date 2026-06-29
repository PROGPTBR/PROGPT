import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  console.log("========== WEBHOOK ASAAS ==========");
  console.log(JSON.stringify(body, null, 2));
  console.log("===================================");

  return NextResponse.json({
    received: true,
  });
}