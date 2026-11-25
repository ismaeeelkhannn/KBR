import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import type { RequisitionInput } from "./store.schemas";

export class StoreError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StoreError";
    this.status = status;
  }
}

export async function createRequisition(userId: string, input: RequisitionInput) {
  if (!(await userCanAccessBranch(userId, input.branchId))) {
    throw new StoreError("Is branch ka access aap ke paas nahi", 403);
  }

  const itemIds = [...new Set(input.lines.map((line) => line.inventoryItemId))];
  if (itemIds.length !== input.lines.length) {
    throw new StoreError("Ek hi item ek se zyada line mein nahi ho sakta", 422);
  }
  const found = await db.inventoryItem.count({ where: { id: { in: itemIds } } });
  if (found !== itemIds.length) {
    throw new StoreError("Kuch items mojood nahi hain", 422);
  }

  try {
    return await db.$transaction(async (tx) => {
      const count = await tx.storeRequisition.count({
        where: { branchId: input.branchId },
      });
      const requisitionNo = `REQ-${String(count + 1).padStart(6, "0")}`;

      return tx.storeRequisition.create({
        data: {
          branchId: input.branchId,
          requisitionNo,
          requestedById: userId,
          purpose: input.purpose,
          lines: {
            create: input.lines.map((line) => ({
              inventoryItemId: line.inventoryItemId,
              requestedQty: line.requestedQty,
              note: line.note,
            })),
          },
        },
        include: { lines: true },
      });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new StoreError("Requisition number clash, dobara try karein", 409);
    }
    throw error;
  }
}

export async function listRequisitions(userId: string, branchId: string) {
  if (!(await userCanAccessBranch(userId, branchId))) {
    throw new StoreError("Is branch ka access aap ke paas nahi", 403);
  }
  const canManage = await userHasPermission(userId, "inventory.manage");

  return db.storeRequisition.findMany({
    where: { branchId, ...(canManage ? {} : { requestedById: userId }) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { lines: true },
  });
}
