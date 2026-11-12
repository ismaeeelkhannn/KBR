import { db } from "@/lib/db";

/** User ke role mein permission hai ya nahi. */
export async function userHasPermission(
  userId: string,
  code: string
): Promise<boolean> {
  const count = await db.rolePermission.count({
    where: {
      permission: { code },
      role: { users: { some: { id: userId } } },
    },
  });
  return count > 0;
}

/** User ko is branch ka access hai ya nahi. */
export async function userCanAccessBranch(
  userId: string,
  branchId: string
): Promise<boolean> {
  const access = await db.userBranchAccess.findUnique({
    where: { userId_branchId: { userId, branchId } },
  });
  return Boolean(access);
}
