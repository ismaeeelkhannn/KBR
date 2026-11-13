import "dotenv/config";
import { db } from "../lib/db";

/**
 * Outbox worker. Alag terminal mein chalta hai: npm run worker
 * - PENDING events lekar process karta hai.
 * - Fail hone par attempts barhta hai. 5 baar fail ho to FAILED.
 * - Abhi channel sirf console hai. Email, WhatsApp, Web Push ke adapters
 *   isi dispatch() function mein baad mein add honge.
 */

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const IDLE_MS = 3000;

type ClaimedEvent = {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
};

async function dispatch(type: string, payload: unknown): Promise<void> {
  switch (type) {
    case "approval.requested":
      console.log(
        "[NOTIFY OWNER] Cancel request aayi:",
        JSON.stringify(payload)
      );
      return;
    case "approval.decided":
      console.log("[NOTIFY] Approval decide hui:", JSON.stringify(payload));
      return;
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/** Ek batch ko lock karke process karta hai. FOR UPDATE SKIP LOCKED se do workers ek event ko nahi uthaate. */
async function processBatch(): Promise<number> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedEvent[]>`
      SELECT id, type, payload, attempts
      FROM "OutboxEvent"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `;

    for (const row of rows) {
      const attempts = row.attempts + 1;
      try {
        await dispatch(row.type, row.payload);
        await tx.outboxEvent.update({
          where: { id: row.id },
          data: { status: "SENT", sentAt: new Date(), attempts },
        });
      } catch (error) {
        await tx.outboxEvent.update({
          where: { id: row.id },
          data: {
            attempts,
            lastError: error instanceof Error ? error.message : String(error),
            status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          },
        });
      }
    }

    return rows.length;
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("Outbox worker shuru ho gaya. Band karne ke liye Ctrl + C.");

  while (true) {
    const processed = await processBatch().catch((error) => {
      console.error("Worker batch error:", error);
      return 0;
    });
    if (processed === 0) await sleep(IDLE_MS);
  }
}

process.on("SIGINT", async () => {
  await db.$disconnect();
  process.exit(0);
});

main();
