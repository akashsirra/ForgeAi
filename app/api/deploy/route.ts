import { NextResponse } from "next/server";
import { adminAuth } from "../../../lib/firebase-admin";

const VERCEL_API = "https://api.vercel.com";
const VERCEL_PROJECT_ID = "prj_P3VEGwzhfCNVTo4bYYQrls4A7D4k";

export async function POST(req: Request) {
  try {
    const token = process.env.VERCEL_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "VERCEL_TOKEN is not configured." },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const idToken = authHeader.slice(7);

    try {
      await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired authentication token." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const html = body?.html;

    if (!html || typeof html !== "string") {
      return NextResponse.json(
        { error: "No website HTML was provided." },
        { status: 400 }
      );
    }

    const deployment = await fetch(`${VERCEL_API}/v13/deployments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "forgeai-site",
        project: VERCEL_PROJECT_ID,
        target: "production",
        files: [
          {
            file: "index.html",
            data: html,
          },
        ],
      }),
    });

    const text = await deployment.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: `Vercel returned an invalid response (${deployment.status}).` },
        { status: 502 }
      );
    }

    if (!deployment.ok) {
      console.error("Vercel deployment failed:", data);

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `Vercel deployment failed (${deployment.status}).`,
        },
        { status: deployment.status }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.url ? `https://${data.url}` : null,
      deploymentId: data.id || null,
      readyState: data.readyState || data.status || null,
    });
  } catch (error) {
    console.error("DEPLOY API ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to deploy the website.",
      },
      { status: 500 }
    );
  }
}
