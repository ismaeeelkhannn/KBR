import { NextResponse } from "next/server";
import { endCurrentSession } from "@/modules/auth/session";

export async function POST() {
  await endCurrentSession();
  return NextResponse.json({ ok: true });
}
