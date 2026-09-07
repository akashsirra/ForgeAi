import { NextResponse } from "next/server";
import { getAdminAuth } from "../../../lib/firebase-admin";
import { createPortalSession, getBillingStatus } from "../../../lib/billing";

async function getUser(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED");
  return getAdminAuth().verifyIdToken(authorization.slice(7));
}

export async function GET(req: Request) {
  try {
    const user = await getUser(req);
    return NextResponse.json(await getBillingStatus(user.uid));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error && error.message === "AUTH_REQUIRED" ? "Authentication required." : "Unable to load billing status." },
      { status: 401 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    const url = await createPortalSession({ userId: user.uid, request: req });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("BILLING PORTAL ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open billing management." },
      { status: 500 }
    );
  }
}
