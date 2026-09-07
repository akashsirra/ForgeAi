import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../lib/firebase-admin";
import { FREE_DEPLOYMENTS_PER_MONTH, getBillingStatus } from "../../../lib/billing";

const VERCEL_API = "https://api.vercel.com";
const MAX_HTML_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 30_000;

async function vercelRequest(path: string, token: string, options: RequestInit = {}) {
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

function makeProjectSlug(name: string, suffix: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "forgeai-site"}-${suffix.slice(0, 6)}`;
}

async function updateProjectDeployment(projectId: string, values: Record<string, unknown>) {
  try {
    await getAdminDb().collection("projects").doc(projectId).update({
      ...values,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Could not update project deployment metadata:", error);
  }
}

async function updateDeploymentRecord(deploymentRecordId: string, values: Record<string, unknown>) {
  try {
    await getAdminDb().collection("deployments").doc(deploymentRecordId).update({
      ...values,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Could not update deployment record:", error);
  }
}

async function enforceDeploymentPlan(userId: string) {
  // Keep the existing free behavior until Stripe is configured. Once a Stripe
  // price is present, free users receive one production deployment per month.
  if (!process.env.STRIPE_PRICE_ID || process.env.BILLING_ENFORCE !== "true") {
    return { allowed: true, plan: "free" as const, remaining: null as number | null };
  }

  const billing = await getBillingStatus(userId);
  if (billing.plan === "pro") {
    return { allowed: true, plan: "pro" as const, remaining: null as number | null };
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const startIso = monthStart.toISOString();

  const snapshot = await getAdminDb()
    .collection("deployments")
    .where("userId", "==", userId)
    .get();

  const used = snapshot.docs.filter((item) => {
    const createdAt = item.data()?.createdAt;
    return typeof createdAt === "string" && createdAt >= startIso;
  }).length;

  const remaining = Math.max(FREE_DEPLOYMENTS_PER_MONTH - used, 0);
  return {
    allowed: remaining > 0,
    plan: "free" as const,
    remaining,
  };
}

export async function POST(req: Request) {
  let projectId: string | null = null;
  let deploymentRecordId: string | null = null;

  try {
    const token = process.env.VERCEL_TOKEN;
    const configuredProjectId = process.env.VERCEL_PROJECT_ID;

    if (!token || !configuredProjectId) {
      return NextResponse.json({ error: "Deployment service is not configured." }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: "Invalid or expired authentication token." }, { status: 401 });
    }

    const access = await enforceDeploymentPlan(decodedToken.uid);
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: "Your free production deployment is used for this month. Upgrade to ForgeAI Pro to keep shipping.",
          code: "PLAN_LIMIT",
          plan: access.plan,
          remaining: access.remaining,
          upgradeUrl: "/pricing",
        },
        { status: 402 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const requestData = typeof body === "object" && body !== null
      ? (body as { html?: unknown; projectId?: unknown; name?: unknown })
      : {};

    const html = requestData.html;
    projectId = typeof requestData.projectId === "string" ? requestData.projectId : null;

    if (typeof html !== "string" || !html.trim()) {
      return NextResponse.json({ error: "No website HTML was provided." }, { status: 400 });
    }

    if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "Website HTML is too large to deploy." }, { status: 413 });
    }

    const db = getAdminDb();
    const deploymentRef = db.collection("deployments").doc();
    deploymentRecordId = deploymentRef.id;

    let projectName = typeof requestData.name === "string" && requestData.name.trim()
      ? requestData.name.trim()
      : "ForgeAI Site";
    let projectSlug = makeProjectSlug(projectName, deploymentRecordId);

    if (projectId) {
      const projectSnapshot = await db.collection("projects").doc(projectId).get();
      if (!projectSnapshot.exists) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }

      const project = projectSnapshot.data();
      if (project?.userId !== decodedToken.uid) {
        return NextResponse.json({ error: "You do not have access to this project." }, { status: 403 });
      }

      projectName = typeof project.name === "string" && project.name.trim() ? project.name.trim() : projectName;
      projectSlug = typeof project.slug === "string" && project.slug ? project.slug : makeProjectSlug(projectName, projectId);
    }

    await deploymentRef.set({
      userId: decodedToken.uid,
      projectId,
      slug: projectSlug,
      name: projectName,
      status: "deploying",
      deploymentUrl: null,
      deploymentId: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (projectId) {
      await updateProjectDeployment(projectId, {
        slug: projectSlug,
        deploymentStatus: "deploying",
        deploymentError: null,
      });
    }

    const deploymentResponse = await vercelRequest(
      getConfiguredVercelPath("/v13/deployments?skipAutoDetectionConfirmation=1&forceNew=1"),
      token,
      {
        method: "POST",
        body: JSON.stringify({
          name: "forgeai",
          project: configuredProjectId,
          target: "production",
          files: [{ file: "index.html", data: html }],
        }),
      }
    );

    const deploymentText = await deploymentResponse.text();
    let data: any;

    try {
      data = JSON.parse(deploymentText);
    } catch {
      await updateDeploymentRecord(deploymentRecordId, { status: "failed", error: "Vercel returned an invalid response." });
      if (projectId) await updateProjectDeployment(projectId, { deploymentStatus: "failed", deploymentError: "Vercel returned an invalid response." });
      return NextResponse.json({ error: `Vercel returned an invalid response (${deploymentResponse.status}).` }, { status: 502 });
    }

    if (!deploymentResponse.ok) {
      const message = data?.error?.message || `Vercel deployment failed (${deploymentResponse.status}).`;
      await updateDeploymentRecord(deploymentRecordId, { status: "failed", error: message });
      if (projectId) await updateProjectDeployment(projectId, { deploymentStatus: "failed", deploymentError: message });
      return NextResponse.json({ error: message }, { status: deploymentResponse.status });
    }

    let deploymentUrl = data.url ? `https://${data.url}` : null;

    if (!deploymentUrl && data.id) {
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const statusResponse = await vercelRequest(getConfiguredVercelPath(`/v13/deployments/${encodeURIComponent(data.id)}`), token);
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
      const deploymentError = data.readyState === "ERROR"
        ? "Vercel failed to build the deployment."
        : "Vercel accepted the deployment but did not return a usable URL yet.";
      await updateDeploymentRecord(deploymentRecordId, { status: "failed", deploymentId: data.id || null, error: deploymentError });
      if (projectId) await updateProjectDeployment(projectId, { deploymentStatus: "failed", deploymentId: data.id || null, deploymentError });
      return NextResponse.json({ error: deploymentError, deploymentId: data.id || null, readyState: data.readyState || data.status || null }, { status: 502 });
    }

    await updateDeploymentRecord(deploymentRecordId, {
      status: "live",
      deploymentId: data.id || null,
      deploymentUrl,
      error: null,
    });

    if (projectId) {
      await updateProjectDeployment(projectId, {
        slug: projectSlug,
        deploymentStatus: "live",
        deploymentId: data.id || null,
        deploymentUrl,
        deploymentError: null,
      });
    }

    return NextResponse.json({
      success: true,
      url: deploymentUrl,
      deploymentId: data.id || null,
      readyState: data.readyState || data.status || null,
      projectId,
      slug: projectSlug,
      deploymentRecordId,
      plan: access.plan,
    });
  } catch (error) {
    console.error("DEPLOY API ERROR:", {
      projectId,
      deploymentRecordId,
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : undefined,
    });

    if (deploymentRecordId) {
      await updateDeploymentRecord(deploymentRecordId, {
        status: "failed",
        error: error instanceof Error && error.name === "AbortError" ? "Deployment service timed out." : "Unable to deploy the website.",
      });
    }

    if (projectId) {
      await updateProjectDeployment(projectId, {
        deploymentStatus: "failed",
        deploymentError: error instanceof Error && error.name === "AbortError" ? "Deployment service timed out." : "Unable to deploy the website.",
      });
    }

    return NextResponse.json(
      { error: error instanceof Error && error.name === "AbortError" ? "Deployment service timed out." : "Unable to deploy the website." },
      { status: 500 }
    );
  }
}
