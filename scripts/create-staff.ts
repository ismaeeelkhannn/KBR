import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/password";

/**
 * DEMO staff user. Sirf development ke liye.
 * .env mein STAFF_USERNAME, STAFF_FULLNAME, STAFF_PASSWORD (12+), STAFF_ROLE set karein.
 */
async function main() {
  const username = process.env.STAFF_USERNAME;
  const fullName = process.env.STAFF_FULLNAME ?? "DEMO Staff";
  const password = process.env.STAFF_PASSWORD;
  const roleCode = process.env.STAFF_ROLE ?? "MANAGER";

  if (!username || !password || password.length < 12) {
    throw new Error(
      "STAFF_USERNAME aur STAFF_PASSWORD (12+ chars) .env mein set karein"
    );
  }

  const role = await db.role.findUnique({ where: { code: roleCode } });
  const branch = await db.branch.findUnique({ where: { code: "DEMO-MAIN" } });
  if (!role || !branch) {
    throw new Error("Pehle npm run db:seed chalayein.");
  }

  const existing = await db.user.findUnique({ where: { username } });
  const user =
    existing ??
    (await db.user.create({
      data: {
        username,
        fullName,
        passwordHash: await hashPassword(password),
        roleId: role.id,
      },
    }));

  await db.userBranchAccess.upsert({
    where: { userId_branchId: { userId: user.id, branchId: branch.id } },
    update: {},
    create: { userId: user.id, branchId: branch.id },
  });

  console.log(
    existing
      ? `User "${username}" pehle se maujood hai.`
      : `Staff "${username}" (${roleCode}) bana diya gaya.`
  );
  console.log("DEMO-MAIN branch access link ho gaya.");
}

main()
  .catch((error: unknown) => {
    console.error("Staff setup failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
