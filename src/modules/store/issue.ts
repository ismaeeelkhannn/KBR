import { z } from "zod";
import { onHandWhere } from "@/modules/inventory/on-hand";
import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import { verifyPassword } from "@/modules/auth/password";
import { checkRateLimit } from "@/modules/auth/rate-limit";
import { lockInventoryItems } from "@/modules/inventory/stock-lock";
import { StoreError } from "./store.service";

export const issueSchema = z.object({
  receiverEmployeeCode: z.string().trim().min(1).max(40),
  pin: z.string().regex(/^\d{4,6}$/, "PIN 4 se 6 digits ka ho"),
});
export type IssueInput = z.infer<typeof issueSchema>;

export async function issueRequisition(
  userId: string,
  requisitionId: string,
  input: IssueInput
) {
  if (!(await userHasPermission(userId, "inventory.manage"))) {
    throw new StoreError("Issue ki ijazat nahi", 403);
  }

  const initial = await db.storeRequisition.findUnique({
    where: { id: requisitionId },
    include: { lines: true },
  });
  if (!initial) {
    throw new StoreError("Requisition nahi mili", 404);
  }
  if (!(await userCanAccessBranch(userId, initial.branchId))) {
    throw new StoreError("Is branch ka access aap ke paas nahi", 403);
  }

  const receiver = await db.employee.findUnique({
    where: { employeeCode: input.receiverEmployeeCode },
  });
  if (
    !receiver ||
    receiver.status !== "ACTIVE" ||
    receiver.deletedAt !== null ||
    receiver.userId === null ||
    receiver.branchId !== initial.branchId
  ) {
    throw new StoreError("Receiver verify nahi hua", 403);
  }
  const receiverUserId: string = receiver.userId;

  if (receiverUserId !== initial.requestedById) {
    throw new StoreError("Receiver wahi staff hona chahiye jisne requisition banayi thi", 403);
  }

  const limit = checkRateLimit(`store-pin:${receiverUserId}`);
  if (!limit.allowed) {
    throw new StoreError(`PIN ki bahut koshishein. ${limit.retryAfterSeconds} second baad dobara try karein`, 429);
  }
  const pinRecord = await db.storeStaffPin.findUnique({
    where: { userId: receiverUserId },
  });
  if (!pinRecord || !(await verifyPassword(pinRecord.pinHash, input.pin))) {
    throw new StoreError("PIN ghalat hai ya set nahi hai", 403);
  }

  return db.$transaction(async (tx) => {
    await lockInventoryItems(
      tx,
      initial.lines.map((line) => line.inventoryItemId)
    );

    const current = await tx.storeRequisition.findUnique({
      where: { id: requisitionId },
      include: { lines: true },
    });
    if (
      !current ||
      (current.status !== "APPROVED" && current.status !== "PARTIAL")
    ) {
      throw new StoreError("Ye requisition issue ke liye approved nahi hai", 409);
    }

    const plan = current.lines
      .map((line) => ({ line, issueQty: line.approvedQty - line.issuedQty }))
      .filter((p) => p.issueQty > 0);
    if (plan.length === 0) {
      throw new StoreError("Issue karne ke liye kuch nahi bacha", 422);
    }

    const items = await tx.inventoryItem.findMany({
      where: { id: { in: plan.map((p) => p.line.inventoryItemId) } },
      select: { id: true, name: true, unit: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    const unitCost = new Map<string, number>();
    for (const p of plan) {
      const itemId = p.line.inventoryItemId;
      const stock = await tx.stockMovement.aggregate({
        where: { branchId: current.branchId, inventoryItemId: itemId, ...onHandWhere },
        _sum: { quantityBase: true },
      });
      const available = stock._sum?.quantityBase ?? 0;
      if (p.issueQty > available) {
        const item = itemById.get(itemId);
        throw new StoreError(
          `Stock kam hai: ${item?.name ?? "item"} (issue ${p.issueQty}, available ${available} ${item?.unit ?? ""})`,
          422
        );
      }

      const purchased = await tx.purchaseLine.aggregate({
        where: { inventoryItemId: itemId },
        _sum: { quantityBase: true, lineTotalPaisa: true },
      });
      const qty = purchased._sum?.quantityBase ?? 0;
      unitCost.set(
        p.line.id,
        qty > 0 ? Math.round((purchased._sum.lineTotalPaisa ?? 0) / qty) : 0
      );
    }

    const voucherCount = await tx.storeIssueVoucher.count({
      where: { branchId: current.branchId },
    });
    const voucherNo = `VCH-${String(voucherCount + 1).padStart(6, "0")}`;

    let total = 0;
    for (const p of plan) {
      const cost = unitCost.get(p.line.id) ?? 0;
      const lineTotal = cost * p.issueQty;
      total += lineTotal;

      await tx.stockMovement.create({
        data: {
          branchId: current.branchId,
          inventoryItemId: p.line.inventoryItemId,
          type: "STORE_ISSUE",
          quantityBase: -p.issueQty,
          reason: `Store issue ${current.requisitionNo} / ${voucherNo}`,
          createdById: userId,
        },
      });

      await tx.storeRequisitionLine.update({
        where: { id: p.line.id },
        data: {
          issuedQty: p.line.approvedQty,
          unitCostPaisa: cost,
          lineTotalPaisa: lineTotal,
        },
      });
    }

    const result = await tx.storeRequisition.updateMany({
      where: { id: requisitionId, status: current.status },
      data: {
        status: "ISSUED",
        issuedById: userId,
        issuedAt: new Date(),
        totalPaisa: total,
      },
    });
    if (result.count === 0) {
      throw new StoreError("Status change ho chuka hai, dobara load karein", 409);
    }

    return tx.storeIssueVoucher.create({
      data: {
        branchId: current.branchId,
        voucherNo,
        requisitionId,
        totalPaisa: total,
        issuedById: userId,
        receivedById: receiverUserId,
        verifyMethod: "EMPLOYEE_PIN",
      },
      include: { requisition: { include: { lines: true } } },
    });
  });
}