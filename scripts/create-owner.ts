import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/modules/auth/password";

/**
 * DEMO owner user banata hai.
 * - Pehle `npm run db:seed` chalana zaroori hai (OWNER role aur DEMO-MAIN branch chahiye).
 * - Agar user pehle se maujood hai to password nahi badalta.
 */
async function main() {
  const username = process.env.DEMO_OWNER_USERNAME;
  const fullName = process.env.DEMO_OWNER_FULLNAME ?? "DEMO Owner";
  const password = process.env.DEMO_OWNER_PASSWORD;

  if (!username || !password || password.length < 12) {
    throw new Error(
      "DEMO_OWNER_USERNAME aur DEMO_OWNER_PASSWORD (12+ characters) .env mein set karein"
    );
  }

  const role = await db.role.findUnique({ where: { code: "OWNER" } });
  const branch = await db.branch.findUnique({ where: { code: "DEMO-MAIN" } });

  if (!role || !branch) {
    throw new Error(
      "Pehle npm run db:seed chalayein. OWNER role ya DEMO-MAIN branch nahi mila."
    );
  }

  const existing = await db.user.findUnique({ where: { username } });

  if (existing) {
    console.log(
      `User "${username}" pehle se maujood hai. Password nahi badla gaya.`
    );
  } else {
    await db.user.create({
      data: {
        username,
        fullName,
        passwordHash: await hashPassword(password),
        roleId: role.id,
      },
    });
    console.log(`Owner user "${username}" bana diya gaya.`);
  }

  const user = await db.user.findUniqueOrThrow({ where: { username } });

  await db.userBranchAccess.upsert({
    where: { userId_branchId: { userId: user.id, branchId: branch.id } },
    update: {},
    create: { userId: user.id, branchId: branch.id },
  });

  console.log("Owner ka DEMO-MAIN branch se access link ho gaya.");
}

main()
  .catch((error: unknown) => {
    console.error("Owner setup failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
