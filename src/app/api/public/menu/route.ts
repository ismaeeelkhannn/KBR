import { connection, NextResponse } from "next/server";
import { getPublicMenu } from "@/modules/public/menu.service";

export async function GET() {
  await connection();
  try {
    const menu = await getPublicMenu();
    return NextResponse.json({ ok: true, currency: "PKR", menu });
  } catch (error) {
    console.error("Public menu error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
