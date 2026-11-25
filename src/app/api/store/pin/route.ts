import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/session";
import { pinSchema, setOwnStorePin } from "@/modules/store/store-pin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Login zaroori hai" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request JSON nahi hai" }, { status: 400 });
  }

  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input ghalat hai", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const result = await setOwnStorePin(user.id, parsed.data.pin);
  return NextResponse.json(result);
}