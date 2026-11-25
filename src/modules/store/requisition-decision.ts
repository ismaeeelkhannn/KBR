import { z } from "zod";
import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import { StoreError } from "./store.service";

export const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().max(200).optional(),
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        approvedQty: z.number().int().min(0).max(100000),
      })
    )
    .optional(),
});
export type DecisionInput = z.infer<typeof decisionSchema>;

export async function decideRequisition(
  userId: string,
  requisitionId: string,
  input: DecisionInput
) {
  if (!(await userHasPermission(userId, "inventory.manage"))) {
    throw new StoreError("Approval ki ijazat nahi", 403);
  }

  const requisition = await db.storeRequisition.findUnique({
    where: { id: requisitionId },
    include: { lines: true },
  });
  if (!requisition) {
    throw new StoreError("Requisition nahi mili", 404);
  }
  if (!(await userCanAccessBranch(userId, requisition.branchId))) {
    throw new StoreError("Is branch ka access aap ke paas nahi", 403);
  }
  if (requisition.status !== "REQUESTED") {
    throw new StoreError("Ye requisition pehle se decide ho chuki hai", 409);
  }

  if (input.decision === "REJECT") {
    const result = await db.storeRequisition.updateMany({
      where: { id: requisitionId, status: "REQUESTED" },
      data: {
        status: "REJECTED",
        rejectReason: input.reason ?? "Reject kar di gayi",
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new StoreError("Status change ho chuka hai, dobara load karein", 409);
    }
    return db.storeRequisition.findUnique({
      where: { id: requisitionId },
      include: { lines: true },
    });
  }

  const lineById = new Map(requisition.lines.map((line) => [line.id, line]));
  const approvals = new Map(
    (input.lines ?? []).map((line) => [line.lineId, line.approvedQty])
  );
  for (const lineId of approvals.keys()) {
    if (!lineById.has(lineId)) {
      throw new StoreError("Requisition ki koi line ghalat hai", 422);
    }
  }

  const plan = requisition.lines.map((line) => {
    const approvedQty = approvals.get(line.id) ?? line.requestedQty;
    if (approvedQty > line.requestedQty) {
      throw new StoreError("Approved quantity requested se zyada nahi ho sakti", 422);
    }
    return { lineId: line.id, approvedQty };
  });
  if (plan.every((p) => p.approvedQty === 0)) {
    throw new StoreError("Sab lines zero hain. Requisition reject karein", 422);
  }

  const items = await db.inventoryItem.findMany({
    where: { id: { in: requisition.lines.map((l) => l.inventoryItemId) } },
    select: { id: true, name: true, unit: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));

  for (const p of plan) {
    if (p.approvedQty === 0) continue;
    const line = lineById.get(p.lineId)!;
    const aggregate = await db.stockMovement.aggregate({
      where: { branchId: requisition.branchId, inventoryItemId: line.inventoryItemId },
      _sum: { quantityBase: true },
    });
    const available = aggregate._sum.quantityBase ?? 0;
    if (p.approvedQty > available) {
      const item = itemById.get(line.inventoryItemId);
      throw new StoreError(
        `Stock kam hai: ${item?.name ?? "item"} (approve ${p.approvedQty}, available ${available} ${item?.unit ?? ""})`,
        422
      );
    }
  }

  const fullyApproved = plan.every(
    (p) => p.approvedQty === lineById.get(p.lineId)!.requestedQty
  );
  const status = fullyApproved ? "APPROVED" : "PARTIAL";

  return db.$transaction(async (tx) => {
    const result = await tx.storeRequisition.updateMany({
      where: { id: requisitionId, status: "REQUESTED" },
      data: { status, approvedById: userId, approvedAt: new Date() },
    });
    if (result.count === 0) {
      throw new StoreError("Status change ho chuka hai, dobara load karein", 409);
    }
    for (const p of plan) {
      await tx.storeRequisitionLine.update({
        where: { id: p.lineId },
        data: { approvedQty: p.approvedQty },
      });
    }
    return tx.storeRequisition.findUnique({
      where: { id: requisitionId },
      include: { lines: true },
    });
  });
}