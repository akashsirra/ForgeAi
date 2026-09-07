import { NextResponse } from "next/server";

export async function GET() {
  const configured = {
    ai: Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY),
    deployment: Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID),
    billing: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET),
    auth: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_CLIENT_EMAIL),
  };

  const healthy = configured.ai && configured.deployment && configured.auth;

  return NextResponse.json(
    {
      ok: healthy,
      service: "forgeai",
      version: "0.1.0",
      configured,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
