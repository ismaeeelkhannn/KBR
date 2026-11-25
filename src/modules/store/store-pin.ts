import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/modules/auth/password";

export const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN 4 se 6 digits ka ho"),
});

export async function setOwnStorePin(userId: string, pin: string) {
  const pinHash = await hashPassword(pin);
  await db.storeStaffPin.upsert({
    where: { userId },
    create: { userId, pinHash },
    update: { pinHash },
  });
  return { ok: true };
}