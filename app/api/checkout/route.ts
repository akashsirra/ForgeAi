import { NextResponse } from "next/server";
import { getAdminAuth } from "../../../lib/firebase-admin";
import { createCheckoutSession } from "../../../lib/billing";

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(authorization.slice(7));
    const url = await createCheckoutSession({
      userId: decoded.uid,
      email: decoded.email,
      request: req,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 500 }
    );
  }
}
