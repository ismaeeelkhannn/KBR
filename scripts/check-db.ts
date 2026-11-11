import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  console.log("Database se connect ho raha hai...");

  const result = await db.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
  const serverTime = result[0]?.now;

  if (!serverTime) {
    throw new Error("Database ne server time return nahi kiya.");
  }

  console.log("Database connected successfully.");
  console.log("Server time:", serverTime);
}

main()
  .catch((error: unknown) => {
    console.error("Database connection FAILED.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
