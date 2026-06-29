import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const headers = Object.fromEntries(req.headers.entries());
  const body = await req.json();

  const event = body.event;
  const payment = body.payment;

  const customerId = payment?.customer;
  const subscriptionId = payment?.subscription;

  console.log("");
  console.log("========================================");
  console.log("WEBHOOK ASAAS RECEBIDO");
  console.log("========================================");

  console.log("HEADERS");
  console.log(headers);

  console.log("");

  console.log("BODY");
  console.log(JSON.stringify(body, null, 2));

  console.log("");
  console.log("EVENTO:", event);
  console.log("CUSTOMER ID:", customerId);
  console.log("SUBSCRIPTION ID:", subscriptionId);

  console.log("");

  return NextResponse.json({
    received: true,
  });
}