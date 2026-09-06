import { NextResponse } from "next/server";
import { getAdminAuth } from "../../../lib/firebase-admin";

const VERCEL_API = "https://api.vercel.com";
const MAX_HTML_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 30_000;

async function vercelRequest(
  path: string,
  token: string,
  options: RequestInit = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${VERCEL_API}${path}`, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getConfiguredVercelPath(path: string) {
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!teamId) return path;

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}teamId=${encodeURIComponent(teamId)}`;
}

export async function POST(req: Request) {
  try {
    const token = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;

    if (!token || !projectId) {
      return NextResponse.json(
        { error: "Deployment service is not configured." },
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

    try {
      await getAdminAuth().verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired authentication token." },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const html =
      typeof body === "object" && body !== null && "html" in body
        ? (body as { html?: unknown }).html
        : undefined;

    if (typeof html !== "string" || !html.trim()) {
      return NextResponse.json(
        { error: "No website HTML was provided." },
        { status: 400 }
      );
    }

    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
      return NextResponse.json(
        { error: "Website HTML is too large to deploy." },
        { status: 413 }
      );
    }

    const deploymentResponse = await vercelRequest(
      getConfiguredVercelPath(
        "/v13/deployments?skipAutoDetectionConfirmation=1&forceNew=1"
      ),
      token,
      {
        method: "POST",
        body: JSON.stringify({
          name: "forgeai",
          project: projectId,
          target: "production",
          files: [
            {
              file: "index.html",
              data: html,
            },
          ],
        }),
      }
    );

    const deploymentText = await deploymentResponse.text();

    let data: any;
    try {
      data = JSON.parse(deploymentText);
    } catch {
      return NextResponse.json(
        {
          error: `Vercel returned an invalid response (${deploymentResponse.status}).`,
        },
        { status: 502 }
      );
    }

    if (!deploymentResponse.ok) {
      console.error("Vercel deployment failed:", {
        status: deploymentResponse.status,
        message: data?.error?.message,
        code: data?.error?.code,
      });

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            `Vercel deployment failed (${deploymentResponse.status}).`,
        },
        { status: deploymentResponse.status }
      );
    }

    let deploymentUrl = data.url ? `https://${data.url}` : null;

    if (!deploymentUrl && data.id) {
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const statusResponse = await vercelRequest(
          getConfiguredVercelPath(
            `/v13/deployments/${encodeURIComponent(data.id)}`
          ),
          token
        );

        if (!statusResponse.ok) continue;

        const statusData = await statusResponse.json();

        if (statusData.url) {
          deploymentUrl = `https://${statusData.url}`;
          data = statusData;
          break;
        }

        if (["ERROR", "CANCELED"].includes(statusData.readyState)) {
          data = statusData;
          break;
        }
      }
    }

    if (!deploymentUrl) {
      return NextResponse.json(
        {
          error:
            data.readyState === "ERROR"
              ? "Vercel failed to build the deployment."
              : "Vercel accepted the deployment but did not return a usable URL yet.",
          deploymentId: data.id || null,
          readyState: data.readyState || data.status || null,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      url: deploymentUrl,
      deploymentId: data.id || null,
      readyState: data.readyState || data.status || null,
      projectId,
    });
  } catch (error) {
    console.error("DEPLOY API ERROR:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : undefined,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "AbortError"
            ? "Deployment service timed out."
            : "Unable to deploy the website.",
      },
      { status: 500 }
    );
  }
}
