import { NextResponse } from "next/server";
import { adminAuth } from "../../../lib/firebase-admin";

const VERCEL_API = "https://api.vercel.com";
const VERCEL_TEAM_ID = "team_MCx5QrX33yJ4QTfXvvnmiDQE";
const DEPLOY_PROJECT_NAME = "forgeai-sites";

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

    // Find the dedicated generated-sites project.
    let projectResponse = await vercelRequest(
      `/v9/projects/${encodeURIComponent(DEPLOY_PROJECT_NAME)}?teamId=${VERCEL_TEAM_ID}`,
      token
    );

    let project: any;

    if (projectResponse.ok) {
      project = await projectResponse.json();
    } else if (projectResponse.status === 404) {
      // Create the generated-sites project as a static/no-framework project.
      projectResponse = await vercelRequest(
        `/v9/projects?teamId=${VERCEL_TEAM_ID}`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            name: DEPLOY_PROJECT_NAME,
            framework: null,
          }),
        }
      );

      const projectText = await projectResponse.text();

      if (!projectResponse.ok) {
        let errorData: any = null;
        try {
          errorData = JSON.parse(projectText);
        } catch {}

        return NextResponse.json(
          {
            error:
              errorData?.error?.message ||
              `Unable to create deployment project (${projectResponse.status}).`,
          },
          { status: projectResponse.status }
        );
      }

      project = JSON.parse(projectText);
    } else {
      const text = await projectResponse.text();
      return NextResponse.json(
        {
          error: `Unable to access Vercel project (${projectResponse.status}).`,
          details: text.slice(0, 500),
        },
        { status: projectResponse.status }
      );
    }

    const projectId = project?.id;

    if (!projectId) {
      return NextResponse.json(
        { error: "Vercel deployment project ID was not returned." },
        { status: 502 }
      );
    }

    // Deploy the generated HTML to the dedicated static project.
    const deploymentResponse = await vercelRequest(
      `/v13/deployments?teamId=${VERCEL_TEAM_ID}&skipAutoDetectionConfirmation=1&forceNew=1`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          name: DEPLOY_PROJECT_NAME,
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

    return NextResponse.json({
      success: true,
      url: data.url ? `https://${data.url}` : null,
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
