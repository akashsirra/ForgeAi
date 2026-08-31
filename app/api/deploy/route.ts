import { NextResponse } from "next/server";
import { adminAuth } from "../../../lib/firebase-admin";

const VERCEL_API = "https://api.vercel.com";
const VERCEL_TEAM_ID = "team_MCx5QrX33yJ4QTfXvvnmiDQE";
const VERCEL_PROJECT_ID = "prj_iurYnOGELWJYOZyW06DF6aHcCW4k";

async function vercelRequest(
  path: string,
  token: string,
  options: RequestInit = {}
) {
  return fetch(`${VERCEL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

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

    try {
      await adminAuth.verifyIdToken(authHeader.slice(7));
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

    // Deploy directly to the existing ForgeAI Vercel project.
    const projectId = VERCEL_PROJECT_ID;

    // Deploy the generated HTML to the dedicated static project.
    const deploymentResponse = await vercelRequest(
      `/v13/deployments?teamId=${VERCEL_TEAM_ID}&skipAutoDetectionConfirmation=1&forceNew=1`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          name: "forgeai",
          project: projectId,
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
          details: deploymentText.slice(0, 500),
        },
        { status: 502 }
      );
    }

    if (!deploymentResponse.ok) {
      console.error("Vercel deployment failed:", data);

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

    // Vercel may return the deployment before its URL is populated.
    // Poll briefly until the deployment has a URL or reaches a terminal state.
    if (!deploymentUrl && data.id) {
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const statusResponse = await vercelRequest(
          `/v13/deployments/${encodeURIComponent(data.id)}?teamId=${VERCEL_TEAM_ID}`,
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
          error: "Vercel accepted the deployment but did not return a usable URL yet.",
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
